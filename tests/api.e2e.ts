/**
 * PRUEBAS DE EXTREMO A EXTREMO de la API.
 * Requiere la API corriendo (bun run dev) con los datos de prueba recién cargados (bun run db:seed).
 *
 *   bun run test:e2e
 *   API_URL=http://localhost:3000 bun run test:e2e
 */
const API = process.env.API_URL || 'http://localhost:3000';
let failures = 0;
async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) as any };
}
function check(name: string, ok: boolean, extra = '') { console.log(`${ok ? '✅' : '❌'} ${name} ${extra}`); if (!ok) failures++; }

const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const tomorrow = iso(new Date(today.getTime() + 86400000));
const in3 = iso(new Date(today.getTime() + 3 * 86400000));

// ---- Auth
let r = await call('POST', '/auth/login', { email: 'jugador@demo.com', password: 'mala' });
check('login contraseña incorrecta → 401', r.status === 401, r.data?.error);
r = await call('POST', '/auth/login', { email: 'jugador@demo.com', password: 'demo1234' });
check('login jugador', r.status === 200 && r.data.user.role === 'player' && r.data.token, r.data?.user?.name);
const player = r.data.token;
r = await call('POST', '/auth/login', { email: 'propietario@demo.com', password: 'demo1234' });
const owner = r.data.token; check('login propietario', r.status === 200 && r.data.user.role === 'owner');
r = await call('POST', '/auth/login', { email: 'admin@demo.com', password: 'demo1234' });
const admin = r.data.token; check('login admin', r.status === 200 && r.data.user.role === 'admin');
r = await call('POST', '/auth/register', { name: 'Nuevo Jugador', email: 'nuevo@demo.com', password: '123456', role: 'admin' });
check('registro como admin → 400', r.status === 400, r.data?.error);
r = await call('POST', '/auth/register', { name: 'Nuevo Jugador', email: 'nuevo@demo.com', password: '123456', role: 'owner' });
check('registro propietario', r.status === 200 && r.data.user.role === 'owner' && r.data.token);
r = await call('POST', '/auth/register', { name: 'Nuevo Jugador', email: 'nuevo@demo.com', password: '123456' });
check('registro duplicado → 409', r.status === 409, r.data?.error);
r = await call('POST', '/auth/register', { name: 'X', email: 'no-es-correo', password: '1' });
check('registro inválido → 400 con mensaje', r.status === 400, r.data?.error);
r = await call('GET', '/auth/me');
check('me sin token → 401', r.status === 401);
r = await call('PATCH', '/auth/me', { whatsapp: '987654321' }, player);
check('editar perfil', r.status === 200 && r.data.whatsapp === '987654321');
r = await call('POST', '/auth/provider', { provider: 'google' });
check('login google simulado', r.status === 200 && r.data.user.email === 'usuario.google@demo.com');

// ---- Slots (canchas reales del propietario demo: pe-001 Deporzeta, pe-002 Marceti Club, pe-003 Sport Plaza)
const C1 = 'pe-001', C2 = 'pe-002', OTHER = 'pe-100';
r = await call('GET', `/fields/${C1}/slots?date=${tomorrow}`);
const slots = r.data.slots as any[];
check('slots de mañana', r.status === 200 && slots.length > 0, `${slots.length} horarios; 19:00=${slots.find((s) => s.startTime === '19:00')?.status}`);
check('  reserva del seed (19:00 BOOKED)', slots.find((s) => s.startTime === '19:00')?.status === 'BOOKED');
check('  respeta el horario real (abre 15:00 entre semana)', !slots.some((s) => s.startTime < '15:00') || slots[0].startTime >= '07:00');
r = await call('GET', `/fields/${C1}/calendar?from=${tomorrow}&days=3`);
check('calendario 3 días', r.status === 200 && r.data.length === 3);
/** Primeras N horas libres seguidas de una cancha en una fecha */
const freeSlots = async (fieldId: string, date: string, n = 1) => {
  const { data } = await call('GET', `/fields/${fieldId}/slots?date=${date}`);
  const free = (data.slots as any[]).filter((s) => s.status === 'AVAILABLE').map((s) => s.startTime);
  return free.slice(0, n);
};

// ---- Bookings
const customer = { firstName: 'Lucía', lastName: 'Ramírez', phone: '987654321', email: 'jugador@demo.com' };
const [h1, h2, h3, h4, h5] = await freeSlots(C1, in3, 5); // fin de semana: abre 07:00
const price = (await call('GET', `/fields/${C1}`)).data.pricePerHour;
r = await call('POST', '/bookings', { fieldId: C1, date: in3, slots: [h1, h2, h4], customer, paymentMethod: 'yape' }, player);
check('reserva 3 horas (2 bloques)', r.status === 200 && r.data.hours === 3 && r.data.totalPrice === price * 3 && r.data.slots.length === 2, `${r.data?.bookingCode} ${JSON.stringify(r.data?.slots)}`);
const booking = r.data;
r = await call('POST', '/bookings', { fieldId: C1, date: in3, slots: [h2], customer });
check('doble reserva → 409', r.status === 409, r.data?.error);
r = await call('POST', '/bookings', { fieldId: C1, date: in3, slots: [h1, h2, h3, h4, h5], customer });
check('más de 4 horas → 400', r.status === 400, r.data?.error);
r = await call('POST', '/bookings', { fieldId: C1, date: '2020-01-01', slots: ['15:00'], customer });
check('fecha pasada → 400', r.status === 400, r.data?.error);
r = await call('POST', '/bookings', { fieldId: C1, date: in3, slots: ['05:00'], customer });
check('fuera de horario → 409', r.status === 409, r.data?.error);
r = await call('POST', '/bookings', { fieldId: OTHER, date: in3, slots: ['15:00'], customer });
check('cancha sin precio publicado → 400', r.status === 400, r.data?.error);
const [g1] = await freeSlots(C2, in3);
r = await call('POST', '/bookings', { fieldId: C2, date: in3, startTime: g1, endTime: `${String(Number(g1.slice(0, 2)) + 1).padStart(2, '0')}:00`, customer: { firstName: 'Ana', lastName: 'Invitada', phone: '911222333', email: 'ana@correo.com' }, paymentMethod: 'onsite' });
check('reserva de invitado (sin token, pago en cancha)', r.status === 200 && r.data.userId === null && r.data.paymentStatus === 'PENDING', r.data?.bookingCode);
const guest = r.data;
r = await call('GET', `/bookings/code/${guest.bookingCode.toLowerCase()}`);
check('consultar por código', r.status === 200 && r.data.id === guest.id && r.data.field?.name);
r = await call('POST', '/bookings/lookup', { codes: [guest.bookingCode, booking.bookingCode] });
check('lookup por códigos', r.status === 200 && r.data.length === 2);
r = await call('GET', '/bookings/me', undefined, player);
check('mis reservas (incluye seed + nueva)', r.status === 200 && r.data.some((b: any) => b.id === booking.id) && r.data.length >= 2, `${r.data.length} reservas, estados: ${[...new Set(r.data.map((b: any) => b.displayStatus))].join(',')}`);
r = await call('POST', `/bookings/${guest.id}/cancel`, {}, player);
check('cancelar reserva ajena → 403', r.status === 403);
r = await call('POST', `/bookings/${guest.id}/cancel`, { bookingCode: guest.bookingCode });
check('invitado cancela con su código', r.status === 200 && r.data.status === 'CANCELLED');
r = await call('GET', `/fields/${C2}/slots?date=${in3}`);
check('  horario liberado al cancelar', r.data.slots.find((s: any) => s.startTime === g1)?.status === 'AVAILABLE');
r = await call('POST', `/bookings/${booking.id}/cancel`, {}, player);
check('jugador cancela la suya', r.status === 200 && r.data.status === 'CANCELLED');

// ---- Reviews / favorites
r = await call('POST', `/fields/${C1}/reviews`, { rating: 5, comment: 'Genial' }, player);
check('reseña (jugador con sesión)', r.status === 200 && r.data.userName === 'Lucía Ramírez');
r = await call('POST', `/fields/${C1}/reviews`, { rating: 4, comment: 'Actualizada' }, player);
const reviews = (await call('GET', `/fields/${C1}/reviews`)).data;
check('  segunda reseña actualiza la anterior (1 por usuario)', r.status === 200 && reviews.filter((x: any) => x.userId === 'u1').length === 1 && reviews[0].rating === 4);
r = await call('POST', `/fields/${OTHER}/reviews`, { rating: 5 });
check('reseña sin sesión → 401', r.status === 401);
r = await call('PUT', `/favorites/${C1}`, undefined, player);
r = await call('GET', '/favorites', undefined, player);
check('favoritos', r.status === 200 && r.data.fieldIds.includes(C1) && r.data.fields[0].name);
r = await call('DELETE', `/favorites/${C1}`, undefined, player);
r = await call('GET', '/favorites', undefined, player);
check('quitar favorito', r.data.fieldIds.length === 0);

// ---- Owner
r = await call('GET', '/owner/fields', undefined, player);
check('owner con token de jugador → 403', r.status === 403);
r = await call('GET', '/owner/fields', undefined, owner);
check('mis canchas (3 en Lima)', r.status === 200 && r.data.length === 3, r.data.map((f: any) => f.name).join(', '));
r = await call('GET', '/owner/stats', undefined, owner);
check('stats propietario', r.status === 200 && r.data.fieldCount === 3 && r.data.todayCount >= 1, `hoy=${r.data.todayCount} próximas=${r.data.upcomingCount} ingresosHoy=${r.data.todayIncome}`);
r = await call('GET', '/owner/schedule-template', undefined, owner);
const schedule = r.data;
r = await call('POST', '/owner/fields', { name: 'Cancha Nueva', types: ['F7'], pricePerHour: 90, address: 'Av. Test 123', department: 'Lima', province: 'Lima', district: 'Barranco', services: ['lighting'], schedule }, owner);
check('crear cancha (coordenadas del distrito)', r.status === 200 && r.data.latitude && r.data.type === 'F7', `${r.data?.id} ${r.data?.latitude},${r.data?.longitude}`);
const newField = r.data;
r = await call('POST', '/owner/fields', { name: 'Mal', types: [], pricePerHour: 0, address: '', department: 'Lima', province: 'Lima', district: 'NoExiste', schedule }, owner);
check('crear cancha inválida → 400', r.status === 400, r.data?.error);
r = await call('POST', '/owner/fields', { name: 'Cancha X', types: ['F7'], pricePerHour: 90, address: 'x', department: 'Lima', province: 'Lima', district: 'NoExiste', schedule }, owner);
check('distrito inexistente → 400', r.status === 400, r.data?.error);
r = await call('PATCH', `/owner/fields/${newField.id}`, { pricePerHour: 95, types: ['F7', 'F5'] }, owner);
check('editar cancha', r.status === 200 && r.data.pricePerHour === 95 && r.data.types.length === 2);
r = await call('POST', `/owner/fields/${newField.id}/blocks`, { date: tomorrow, startTime: '10:00', reason: 'Riego' }, owner);
check('bloquear horario', r.status === 200 && r.data.status === 'BLOCKED');
r = await call('POST', `/owner/fields/${newField.id}/blocks`, { date: tomorrow, startTime: '10:00' }, owner);
check('bloquear dos veces → 409', r.status === 409);
r = await call('DELETE', `/owner/fields/${newField.id}/blocks`, { date: tomorrow, startTime: '10:00' }, owner);
check('desbloquear', r.status === 200 && r.data.removed === 1);
r = await call('PATCH', `/owner/fields/${newField.id}/status`, { status: 'HIDDEN' }, owner);
r = await call('GET', `/fields/${newField.id}`);
check('cancha oculta no es pública → 404', r.status === 404);
r = await call('GET', `/fields/${newField.id}`, undefined, owner);
check('  pero su dueño sí la ve', r.status === 200);
r = await call('DELETE', `/owner/fields/${C1}`, undefined, owner);
check('eliminar cancha con reservas → 409', r.status === 409, r.data?.error);
r = await call('DELETE', `/owner/fields/${newField.id}`, undefined, owner);
check('eliminar cancha nueva', r.status === 200);
r = await call('PATCH', `/owner/fields/${OTHER}/status`, { status: 'HIDDEN' }, owner);
check('editar cancha de otro → 403', r.status === 403);
r = await call('GET', `/owner/bookings?date=${iso(today)}`, undefined, owner);
check('reservas de hoy del propietario', r.status === 200 && r.data.length >= 1 && r.data[0].customer.firstName);

// ---- Admin
r = await call('GET', '/admin/stats', undefined, owner);
check('admin con token de propietario → 403', r.status === 403);
r = await call('GET', '/admin/stats', undefined, admin);
check('admin stats', r.status === 200 && r.data.users >= 12 && r.data.fields === 167, JSON.stringify(r.data));
r = await call('PATCH', `/admin/fields/${OTHER}/approval`, { approvalStatus: 'REJECTED' }, admin);
r = await call('GET', `/fields/${OTHER}`);
check('cancha rechazada no es pública', r.status === 404);
r = await call('PATCH', `/admin/fields/${OTHER}/approval`, { approvalStatus: 'APPROVED' }, admin);
r = await call('GET', '/admin/fields', undefined, admin);
check('admin lista canchas con ownerName', r.data.length === 167 && r.data[0].ownerName);

// ---- Misc
r = await call('GET', '/no-existe');
check('404 JSON', r.status === 404 && r.data.error);
const docs = await fetch(API + '/docs/json').then((x) => x.json());
check('OpenAPI generado', Object.keys(docs.paths).length > 20, `${Object.keys(docs.paths).length} rutas`);

console.log(failures ? `\n${failures} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
process.exit(failures ? 1 : 0);
