/**
 * RUTAS DEL PROPIETARIO — /owner  (rol OWNER o ADMIN)
 * Mis canchas (crear, editar, publicar/ocultar, eliminar), bloqueos de horario,
 * reservas recibidas y estadísticas del panel.
 */
import { Elysia, t } from 'elysia';
import { APP_CONFIG, FIELD_TYPES, SERVICES, getCountry, type Schedule } from '../config/app.ts';
import { getCoordinates, isValidLocation } from '../config/locations.ts';
import { auth, type AuthUser } from '../lib/auth.ts';
import { prisma, type Prisma } from '../lib/db.ts';
import { DATE_RE, TIME_RE, addMinutes, isPastEnd, timeToMinutes, todayISO } from '../lib/dates.ts';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.ts';
import { loadField, loadFields } from '../lib/fields.ts';
import { serializeBooking, serializeField } from '../lib/serialize.ts';

const daySchedule = t.Object({
  open: t.String({ pattern: TIME_RE.source }),
  close: t.String({ pattern: TIME_RE.source }),
  closed: t.Optional(t.Boolean()),
});

const fieldBody = t.Object({
  name: t.String({ minLength: 3, error: 'El nombre debe tener al menos 3 caracteres.' }),
  description: t.Optional(t.String({ maxLength: 3000 })),
  types: t.Array(t.Union(FIELD_TYPES.map((x) => t.Literal(x))), { minItems: 1, error: 'Elige al menos un tipo de cancha.' }),
  whatsapp: t.Optional(t.String()),
  phones: t.Optional(t.Array(t.String(), { maxItems: 10 })),
  pricePerHour: t.Number({ exclusiveMinimum: 0, error: 'El precio por hora debe ser mayor a 0.' }),
  priceMax: t.Optional(t.Nullable(t.Number({ exclusiveMinimum: 0 }))),
  surface: t.Optional(t.Nullable(t.String({ maxLength: 60 }))),
  courts: t.Optional(t.Nullable(t.Integer({ minimum: 1, maximum: 100 }))),
  notes: t.Optional(t.String({ maxLength: 1000 })),
  address: t.String({ minLength: 1, error: 'Ingresa la dirección.' }),
  reference: t.Optional(t.String()),
  department: t.String({ minLength: 1, error: 'Elige el departamento.' }),
  province: t.String({ minLength: 1, error: 'Elige la provincia.' }),
  district: t.String({ minLength: 1, error: 'Elige el distrito.' }),
  latitude: t.Optional(t.Nullable(t.Number())),
  longitude: t.Optional(t.Nullable(t.Number())),
  images: t.Optional(t.Array(t.String(), { maxItems: 10 })),
  services: t.Optional(t.Array(t.Union(SERVICES.map((x) => t.Literal(x))))),
  schedule: t.Record(t.String(), daySchedule, { error: 'Ingresa el horario de atención.' }),
  status: t.Optional(t.Union([t.Literal('DRAFT'), t.Literal('PUBLISHED'), t.Literal('HIDDEN')])),
});

type FieldBody = typeof fieldBody.static;

function validateSchedule(schedule: Record<string, { open: string; close: string; closed?: boolean }>) {
  for (const [day, s] of Object.entries(schedule)) {
    if (!s.closed && timeToMinutes(s.open) >= timeToMinutes(s.close)) throw badRequest(`El horario del día "${day}" no es válido: la hora de cierre debe ser mayor a la de apertura.`);
  }
}

/** Datos listos para guardar (recorta textos, calcula coordenadas del distrito si faltan) */
function toFieldData(data: Partial<FieldBody>, current?: { department: string; province: string; district: string }) {
  const location = { department: data.department ?? current?.department, province: data.province ?? current?.province, district: data.district ?? current?.district };
  if (data.department !== undefined || data.province !== undefined || data.district !== undefined) {
    if (!isValidLocation(location)) throw badRequest('Elige un departamento, provincia y distrito válidos.');
  }
  if (data.schedule) validateSchedule(data.schedule);
  const coords = getCoordinates(location);
  const out: Prisma.FieldUncheckedUpdateInput = {};
  if (data.name !== undefined) out.name = data.name.trim();
  if (data.description !== undefined) out.description = data.description.trim();
  if (data.types !== undefined) out.types = [...new Set(data.types)];
  if (data.whatsapp !== undefined) out.whatsapp = data.whatsapp.trim();
  if (data.phones !== undefined) out.phones = data.phones.map((p) => p.trim()).filter(Boolean);
  if (data.pricePerHour !== undefined) out.pricePerHour = data.pricePerHour;
  if (data.priceMax !== undefined) out.priceMax = data.priceMax;
  if (data.surface !== undefined) out.surface = data.surface?.trim() || null;
  if (data.courts !== undefined) out.courts = data.courts;
  if (data.notes !== undefined) out.notes = data.notes.trim();
  if (data.address !== undefined) out.address = data.address.trim();
  if (data.reference !== undefined) out.reference = data.reference.trim();
  if (data.department !== undefined) out.department = data.department;
  if (data.province !== undefined) out.province = data.province;
  if (data.district !== undefined) out.district = data.district;
  if (data.images !== undefined) out.images = data.images;
  if (data.services !== undefined) out.services = [...new Set(data.services)];
  if (data.schedule !== undefined) out.schedule = data.schedule as Prisma.InputJsonValue;
  if (data.status !== undefined) out.status = data.status;
  if (data.latitude !== undefined || data.longitude !== undefined || data.district !== undefined) {
    out.latitude = data.latitude || coords?.lat || null;
    out.longitude = data.longitude || coords?.lng || null;
  }
  return out;
}

/** La cancha existe y pertenece al usuario (o es administrador) */
async function ownedField(fieldId: string, user: AuthUser) {
  const field = await prisma.field.findUnique({ where: { id: fieldId } });
  if (!field) throw notFound('La cancha no existe.');
  if (field.ownerId !== user.id && user.role !== 'ADMIN') throw forbidden('No tienes permiso para editar esta cancha.');
  return field;
}

const slotBody = t.Object({
  date: t.String({ pattern: DATE_RE.source, error: 'La fecha debe tener el formato YYYY-MM-DD.' }),
  startTime: t.String({ pattern: TIME_RE.source, error: 'La hora debe tener el formato HH:MM.' }),
});

export const ownerRoutes = new Elysia({ prefix: '/owner', tags: ['Propietario'] })
  .use(auth)
  .guard({ auth: ['OWNER', 'ADMIN'] })

  .get('/fields', async ({ user }) => (await loadFields({ ownerId: user.id })).map((i) => i.enriched), { detail: { summary: 'Mis canchas' } })

  .post('/fields', async ({ user, body }) => {
    const data = toFieldData(body);
    const field = await prisma.field.create({
      data: {
        ...(data as Prisma.FieldUncheckedCreateInput),
        ownerId: user.id,
        currency: getCountry().currency,
        country: getCountry().code,
        status: body.status ?? 'PUBLISHED',
        // En el MVP las canchas se aprueban automáticamente. Cuando el panel de
        // administración esté activo, cambiar a 'PENDING'.
        approvalStatus: 'APPROVED',
      },
    });
    return serializeField(field);
  }, { body: fieldBody, detail: { summary: 'Publicar una cancha' } })

  .patch('/fields/:id', async ({ user, params, body }) => {
    const field = await ownedField(params.id, user);
    const updated = await prisma.field.update({ where: { id: field.id }, data: toFieldData(body, field) });
    return (await loadField(updated.id))?.enriched ?? serializeField(updated);
  }, { body: t.Partial(fieldBody), detail: { summary: 'Editar una cancha' } })

  .patch('/fields/:id/status', async ({ user, params, body }) => {
    const field = await ownedField(params.id, user);
    return serializeField(await prisma.field.update({ where: { id: field.id }, data: { status: body.status } }));
  }, { body: t.Object({ status: t.Union([t.Literal('DRAFT'), t.Literal('PUBLISHED'), t.Literal('HIDDEN')]) }), detail: { summary: 'Publicar / ocultar' } })

  /** Eliminar (solo si no tiene reservas futuras confirmadas) */
  .delete('/fields/:id', async ({ user, params }) => {
    const field = await ownedField(params.id, user);
    const upcoming = await prisma.booking.count({ where: { fieldId: field.id, status: 'CONFIRMED', date: { gte: todayISO() } } });
    if (upcoming) throw conflict(`La cancha tiene ${upcoming} reserva(s) próxima(s). Cancélalas antes de eliminarla.`);
    await prisma.field.delete({ where: { id: field.id } }); // availability, reviews y favorites se borran en cascada
    return { ok: true };
  }, { detail: { summary: 'Eliminar una cancha' } })

  /** Bloquear un horario (mantenimiento, uso propio...) */
  .post('/fields/:id/blocks', async ({ user, params, body }) => {
    const field = await ownedField(params.id, user);
    const exists = await prisma.availability.findUnique({ where: { fieldId_date_startTime: { fieldId: field.id, date: body.date, startTime: body.startTime } } });
    if (exists) throw conflict('Ese horario ya está reservado o bloqueado.');
    return prisma.availability.create({
      data: { fieldId: field.id, date: body.date, startTime: body.startTime, endTime: addMinutes(body.startTime, APP_CONFIG.slotDurationMinutes), status: 'BLOCKED', reason: body.reason?.trim() || 'Bloqueado por el propietario' },
    });
  }, { body: t.Intersect([slotBody, t.Object({ reason: t.Optional(t.String({ maxLength: 200 })) })]), detail: { summary: 'Bloquear un horario' } })

  /** Liberar un horario bloqueado (no libera reservas: para eso se cancela la reserva) */
  .delete('/fields/:id/blocks', async ({ user, params, body }) => {
    const field = await ownedField(params.id, user);
    const result = await prisma.availability.deleteMany({ where: { fieldId: field.id, date: body.date, startTime: body.startTime, status: 'BLOCKED' } });
    return { ok: true, removed: result.count };
  }, { body: slotBody, detail: { summary: 'Desbloquear un horario' } })

  .get('/bookings', async ({ user, query }) => {
    const bookings = await prisma.booking.findMany({
      where: { field: { ownerId: user.id }, ...(query.fieldId ? { fieldId: query.fieldId } : {}), ...(query.date ? { date: query.date } : {}) },
      include: { field: true },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    return bookings.map(serializeBooking);
  }, { query: t.Object({ fieldId: t.Optional(t.String()), date: t.Optional(t.String({ pattern: DATE_RE.source })) }), detail: { summary: 'Reservas de mis canchas' } })

  /** Estadísticas del panel */
  .get('/stats', async ({ user }) => {
    const today = todayISO();
    const month = today.slice(0, 7);
    const [fieldCount, bookings] = await Promise.all([
      prisma.field.count({ where: { ownerId: user.id } }),
      prisma.booking.findMany({ where: { field: { ownerId: user.id }, status: { not: 'CANCELLED' } }, include: { field: true }, orderBy: [{ date: 'asc' }, { startTime: 'asc' }] }),
    ]);
    const todayBookings = bookings.filter((b) => b.date === today);
    const upcoming = bookings.filter((b) => b.date > today || (b.date === today && !isPastEnd(b.date, b.endTime)));
    const sum = (list: typeof bookings) => list.reduce((acc, b) => acc + Number(b.totalPrice), 0);
    return {
      fieldCount,
      todayCount: todayBookings.length,
      upcomingCount: upcoming.length,
      todayIncome: sum(todayBookings),
      monthIncome: sum(bookings.filter((b) => b.date.startsWith(month))),
      todayBookings: todayBookings.map(serializeBooking),
      upcoming: upcoming.slice(0, 5).map(serializeBooking),
    };
  }, { detail: { summary: 'Estadísticas del panel' } })

  .get('/schedule-template', () => {
    const day = { open: '08:00', close: '23:00', closed: false };
    return Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((k) => [k, { ...day }])) satisfies Schedule;
  }, { detail: { summary: 'Horario semanal por defecto (plantilla)' } });
