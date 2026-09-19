/**
 * DATOS INICIALES
 * ---------------
 *  - Canchas REALES del Perú: prisma/data/canchas-peru.json (167 locales recopilados
 *    de directorios públicos; ver `source` y `meta.disclaimer` en el JSON).
 *  - Cuentas de prueba (jugadores, propietarios, admin). Los propietarios demo
 *    "administran" algunas canchas reales con precio publicado para poder probar
 *    el panel; el resto queda bajo la cuenta "Directorio".
 *  - Reservas y bloqueos de ejemplo relativos a HOY (solo en canchas de los demo).
 *  - Sin reseñas: no se inventan opiniones sobre negocios reales.
 *
 *   bun run db:seed      → borra todo y vuelve a cargar
 *
 * Todas las cuentas de prueba usan la contraseña: demo1234
 */
import raw from './data/canchas-peru.json';
import { getCoordinates } from '../src/config/locations.ts';
import { hashPassword } from '../src/lib/auth.ts';
import { prisma } from '../src/lib/db.ts';
import { addDays, timeToMinutes, todayISO, weekdayKey } from '../src/lib/dates.ts';

export const DEMO_PASSWORD = 'demo1234';

// ---------------------------------------------------------------- USERS
type Role = 'PLAYER' | 'OWNER' | 'ADMIN';
export const USERS: { id: string; name: string; email: string; phone: string; role: Role; createdAt: string }[] = [
  { id: 'u1', name: 'Lucía Ramírez', email: 'jugador@demo.com', phone: '987654321', role: 'PLAYER', createdAt: '2026-08-01T10:00:00Z' },
  { id: 'u2', name: 'Carlos Mendoza', email: 'propietario@demo.com', phone: '999888777', role: 'OWNER', createdAt: '2026-07-15T10:00:00Z' },
  { id: 'u3', name: 'Rosa Quispe', email: 'rosa@demo.com', phone: '955444333', role: 'OWNER', createdAt: '2026-07-20T10:00:00Z' },
  { id: 'u4', name: 'Administrador', email: 'admin@demo.com', phone: '900000000', role: 'ADMIN', createdAt: '2026-07-01T10:00:00Z' },
  { id: 'u5', name: 'Diego Torres', email: 'diego@demo.com', phone: '944555666', role: 'PLAYER', createdAt: '2026-08-10T10:00:00Z' },
  { id: 'u6', name: 'Miguel Paredes', email: 'miguel@demo.com', phone: '958111222', role: 'OWNER', createdAt: '2026-07-25T10:00:00Z' },
  { id: 'u7', name: 'Karina Vargas', email: 'karina@demo.com', phone: '976333444', role: 'OWNER', createdAt: '2026-07-28T10:00:00Z' },
  { id: 'u8', name: 'José Huamán', email: 'jose@demo.com', phone: '984777888', role: 'OWNER', createdAt: '2026-08-02T10:00:00Z' },
  { id: 'u9', name: 'Valeria Castro', email: 'valeria@demo.com', phone: '912888999', role: 'PLAYER', createdAt: '2026-08-12T10:00:00Z' },
  { id: 'u10', name: 'Renzo Salazar', email: 'renzo@demo.com', phone: '933444555', role: 'PLAYER', createdAt: '2026-08-14T10:00:00Z' },
  // Cuenta que agrupa las canchas del directorio que ningún propietario ha reclamado todavía
  { id: 'u_directorio', name: 'Directorio DondePelotear', email: 'directorio@demo.com', phone: '', role: 'OWNER', createdAt: '2026-07-01T10:00:00Z' },
];

// ---------------------------------------------------------------- FIELDS (datos reales)
type RawField = (typeof raw.fields)[number];
type FieldType = 'F5' | 'F6' | 'F7' | 'F8' | 'F9' | 'F11';
type Day = { open: string; close: string; closed: boolean };

const TYPE_LABEL: Record<string, string> = { F5: 'Fútbol 5', F6: 'Fútbol 6', F7: 'Fútbol 7', F8: 'Fútbol 8', F9: 'Fútbol 9', F11: 'Fútbol 11' };
const DEFAULT_SCHEDULE = { open: '08:00', close: '23:00' };

/** "15:00-00:00" → { open: "15:00", close: "24:00" } (si cruza la medianoche se corta a las 24:00) */
function parseRange(text: string): Day {
  const [open, closeRaw] = text.split('-').map((s) => s.trim());
  const close = closeRaw === '00:00' || timeToMinutes(closeRaw) <= timeToMinutes(open) ? '24:00' : closeRaw;
  return { open, close, closed: false };
}

/** Horario semanal a partir del texto del directorio; si no hay dato, horario referencial */
function toSchedule(schedule: RawField['schedule']) {
  const weekdays = schedule?.weekdays ?? schedule?.all;
  const weekends = schedule?.weekends ?? schedule?.all;
  const wk = weekdays ? parseRange(weekdays) : { ...DEFAULT_SCHEDULE, closed: false };
  const we = weekends ? parseRange(weekends) : { ...DEFAULT_SCHEDULE, closed: false };
  return { mon: wk, tue: wk, wed: wk, thu: wk, fri: wk, sat: we, sun: we };
}

/** Primer celular (9 dígitos que empiezan en 9) para el botón de WhatsApp */
function mobileOf(phones: string[]) {
  return phones.map((p) => p.replace(/\D/g, '')).find((d) => d.length === 9 && d.startsWith('9')) || '';
}

function describe(f: RawField) {
  const types = f.types.map((t) => TYPE_LABEL[t] || t).join(' y ');
  const parts = [`Local de ${types} con grass ${f.surface || 'sintético'} en ${f.district}, ${f.department}.`];
  if (f.courts) parts.push(`Cuenta con ${f.courts} ${f.courts === 1 ? 'cancha' : 'canchas'}.`);
  if (f.notes) parts.push(f.notes.endsWith('.') ? f.notes : `${f.notes}.`);
  if (!f.schedule) parts.push('Horario referencial: confirma con el local antes de ir.');
  if (!f.pricePerHour) parts.push('Precio no publicado: consulta por WhatsApp o teléfono.');
  return parts.join(' ');
}

/** Reparto de propietarios demo: cada uno administra canchas reales de su zona (con precio, para poder reservar) */
function assignOwner(f: RawField, index: number) {
  const priced = Boolean(f.pricePerHour);
  if (f.department === 'Lima' && priced && index < 3) return 'u2';      // propietario@demo.com: 3 canchas en Lima
  if (f.department === 'Lima' && priced && index < 6) return 'u3';      // rosa@demo.com
  if (f.department === 'Arequipa') return 'u6';                          // miguel@demo.com
  if (['La Libertad', 'Piura', 'Lambayeque'].includes(f.department)) return 'u7'; // karina@demo.com
  if (['Cusco', 'Callao'].includes(f.department)) return 'u8';           // jose@demo.com
  return 'u_directorio';
}

let pricedLima = 0;
export const FIELDS = raw.fields.map((f) => {
  const index = f.department === 'Lima' && f.pricePerHour ? pricedLima++ : 999;
  const coords = getCoordinates(f);
  return {
    id: f.id,
    ownerId: assignOwner(f, index),
    name: f.name,
    description: describe(f),
    types: f.types as FieldType[],
    whatsapp: mobileOf(f.phones),
    phones: f.phones,
    pricePerHour: f.pricePerHour?.min ?? null,
    priceMax: f.pricePerHour && f.pricePerHour.max > f.pricePerHour.min ? f.pricePerHour.max : null,
    currency: 'PEN',
    address: f.address,
    reference: f.reference || '',
    department: f.department,
    province: f.province,
    district: f.district,
    country: 'PE',
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
    images: [] as string[],
    services: f.services,
    schedule: toSchedule(f.schedule),
    surface: f.surface || null,
    courts: f.courts ?? null,
    notes: f.notes || '',
    source: f.source || null,
    status: 'PUBLISHED' as const,
    approvalStatus: 'APPROVED' as const,
    createdAt: new Date(`${raw.meta.generatedAt}T12:00:00Z`),
  };
});

// ---------------------------------------------------------------- BOOKINGS + AVAILABILITY (ejemplo)
type BookingStatus = 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'COMPLETED';
type Customer = { firstName: string; lastName: string; phone: string; email: string };

/**
 * Reservas y bloqueos relativos a hoy, solo en canchas administradas por los propietarios demo.
 * Cada reserva crea también sus filas en availability (BOOKED), igual que la API.
 */
export function buildBookings() {
  const today = todayISO();
  let nextFriday = addDays(today, 1);
  while (weekdayKey(nextFriday) !== 'fri') nextFriday = addDays(nextFriday, 1);

  const bookings: any[] = [];
  const availability: any[] = [];
  let counter = 100;
  let availabilityId = 1;
  const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
  const byOwner = (ownerId: string) => FIELDS.filter((f) => f.ownerId === ownerId && f.pricePerHour);
  const [c1, c2, c3] = byOwner('u2'); // canchas de propietario@demo.com
  const [r1, r2] = byOwner('u3');
  const [m1] = byOwner('u6');
  const [k1, k2] = byOwner('u7');
  const [j1] = byOwner('u8');

  /** true si la hora cae dentro del horario de la cancha ese día */
  const opens = (field: (typeof FIELDS)[number], date: string, start: string, hours: number) => {
    const day = field.schedule[weekdayKey(date)];
    return !day.closed && timeToMinutes(start) >= timeToMinutes(day.open) && timeToMinutes(start) + hours * 60 <= timeToMinutes(day.close);
  };

  function addBooking({ userId, field, date, start, hours = 1, status = 'CONFIRMED', customer }: { userId: string; field?: (typeof FIELDS)[number]; date: string; start: string; hours?: number; status?: BookingStatus; customer?: Customer }) {
    if (!field || !opens(field, date, start, hours)) return;
    counter += 1;
    const startH = Number(start.slice(0, 2));
    const endTime = hh(startH + hours);
    const user = USERS.find((u) => u.id === userId)!;
    const c = customer || { firstName: user.name.split(' ')[0], lastName: user.name.split(' ')[1] || '', phone: user.phone, email: user.email };
    bookings.push({
      id: `b${counter}`,
      bookingCode: `DP-2026-${String(counter).padStart(5, '0')}`,
      userId, fieldId: field.id, date,
      startTime: start, endTime,
      slots: [{ startTime: start, endTime }],
      hours,
      totalPrice: field.pricePerHour! * hours,
      status,
      customerFirstName: c.firstName, customerLastName: c.lastName, customerPhone: c.phone, customerEmail: c.email,
      paymentMethod: 'yape', paymentStatus: 'PAID',
      cancelledAt: status === 'CANCELLED' ? new Date() : null,
    });
    if (status !== 'CANCELLED') {
      for (let h = 0; h < hours; h += 1) {
        availability.push({ id: `a${availabilityId++}`, fieldId: field.id, date, startTime: hh(startH + h), endTime: hh(startH + h + 1), status: 'BOOKED', bookingId: `b${counter}` });
      }
    }
  }

  function addBlock(field: (typeof FIELDS)[number] | undefined, date: string, start: string, reason = 'Mantenimiento') {
    if (!field || !opens(field, date, start, 1)) return;
    const startH = Number(start.slice(0, 2));
    availability.push({ id: `a${availabilityId++}`, fieldId: field.id, date, startTime: start, endTime: hh(startH + 1), status: 'BLOCKED', bookingId: null, reason });
  }

  // Reservas de la jugadora demo (u1): una pasada, varias futuras y una cancelada
  addBooking({ userId: 'u1', field: c3, date: addDays(today, -5), start: '19:00' });
  addBooking({ userId: 'u1', field: c1, date: today, start: '20:00' });
  addBooking({ userId: 'u1', field: c2, date: addDays(today, 3), start: '18:00', hours: 2 });
  addBooking({ userId: 'u1', field: r1, date: addDays(today, 6), start: '21:00', status: 'CANCELLED' });

  // Reservas de HOY en las canchas del propietario demo (u2)
  addBooking({ userId: 'u5', field: c1, date: today, start: '09:00' });
  addBooking({ userId: 'u5', field: c1, date: today, start: '10:00' });
  addBooking({ userId: 'u5', field: c1, date: today, start: '18:00' });
  addBooking({ userId: 'u5', field: c1, date: today, start: '21:00' });
  addBooking({ userId: 'u5', field: c2, date: today, start: '16:00', hours: 2 });
  addBooking({ userId: 'u5', field: c2, date: today, start: '20:00' });
  addBooking({ userId: 'u5', field: c3, date: today, start: '19:00' });
  addBooking({ userId: 'u5', field: c3, date: today, start: '21:00', customer: { firstName: 'Jorge', lastName: 'Paredes', phone: '912345678', email: 'jorge@correo.com' } });

  // Próximos días
  addBooking({ userId: 'u5', field: c1, date: addDays(today, 1), start: '19:00', hours: 2 });
  addBooking({ userId: 'u5', field: c1, date: addDays(today, 2), start: '20:00' });
  addBooking({ userId: 'u5', field: c3, date: addDays(today, 1), start: '18:00' });
  addBooking({ userId: 'u5', field: c2, date: addDays(today, 2), start: '10:00', hours: 2 });
  addBooking({ userId: 'u5', field: r1, date: today, start: '20:00' });
  addBooking({ userId: 'u5', field: r2, date: addDays(today, 1), start: '15:00', hours: 2 });
  addBooking({ userId: 'u9', field: r2, date: addDays(today, 2), start: '17:00', hours: 2 });

  // Otras ciudades: el viernes a las 20:00 está ocupado en Arequipa (m1) pero libre en Lima (c1)
  addBooking({ userId: 'u9', field: m1, date: nextFriday, start: '20:00', hours: 2 });
  addBooking({ userId: 'u9', field: k1, date: addDays(today, 1), start: '20:00' });
  addBooking({ userId: 'u5', field: k2, date: addDays(today, 2), start: '10:00', hours: 2 });
  addBooking({ userId: 'u5', field: j1, date: today, start: '19:00' });

  // Horarios bloqueados por los propietarios (mantenimiento, uso propio, etc.)
  addBlock(c1, today, '12:00', 'Mantenimiento del grass');
  addBlock(c1, today, '13:00', 'Mantenimiento del grass');
  addBlock(c1, addDays(today, 1), '08:00', 'Limpieza');
  addBlock(c3, addDays(today, 2), '15:00', 'Uso privado');
  addBlock(c2, addDays(today, 1), '07:00', 'Riego del campo');
  addBlock(m1, nextFriday, '19:00', 'Torneo interno');

  return { bookings, availability, bookingCounter: counter };
}

// ---------------------------------------------------------------- CARGA
export async function seed() {
  const { bookings, availability, bookingCounter } = buildBookings();
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await prisma.$transaction(async (tx) => {
    // Borra todo (el orden respeta las claves foráneas)
    await tx.availability.deleteMany();
    await tx.booking.deleteMany();
    await tx.review.deleteMany();
    await tx.favorite.deleteMany();
    await tx.field.deleteMany();
    await tx.user.deleteMany();
    await tx.counter.deleteMany();

    await tx.user.createMany({ data: USERS.map((u) => ({ ...u, passwordHash })) });
    await tx.field.createMany({ data: FIELDS });
    await tx.booking.createMany({ data: bookings });
    await tx.availability.createMany({ data: availability });
    await tx.counter.create({ data: { key: 'booking', value: bookingCounter } });
  });

  const priced = FIELDS.filter((f) => f.pricePerHour).length;
  console.log(`✅ Datos cargados: ${USERS.length} usuarios, ${FIELDS.length} canchas reales (${priced} con precio publicado), ${bookings.length} reservas de ejemplo, ${availability.length} horarios ocupados.`);
  console.log(`   Contraseña de todas las cuentas de prueba: ${DEMO_PASSWORD}`);
}

if (import.meta.main) {
  seed()
    .catch((error) => { console.error('❌ Error al cargar los datos:', error); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
