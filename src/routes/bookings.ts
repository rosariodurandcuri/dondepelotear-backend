/**
 * RUTAS DE RESERVAS — /bookings
 * Crear (con o sin cuenta), consultar por código, mis reservas y cancelar.
 *
 * Anti doble reserva: la reserva y sus filas de `availability` se crean en UNA
 * transacción; la restricción UNIQUE (fieldId, date, startTime) hace que, si dos
 * personas intentan el mismo horario a la vez, solo una lo consiga (la otra
 * recibe 409).
 */
import { Elysia, t } from 'elysia';
import { APP_CONFIG, PAYMENT_METHODS, type Schedule } from '../config/app.ts';
import { auth } from '../lib/auth.ts';
import { Prisma, prisma } from '../lib/db.ts';
import { DATE_RE, TIME_RE, addDays, groupConsecutiveSlots, isPastEnd, minutesToTime, timeToMinutes, todayISO, totalHours, type Block } from '../lib/dates.ts';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.ts';
import { processPayment } from '../lib/payments.ts';
import { serializeBooking } from '../lib/serialize.ts';
import { areSlotsAvailable, type SlotException } from '../lib/slots.ts';

const PHONE_RE = /^\+?\d[\d\s-]{7,14}$/;
const SLOT = APP_CONFIG.slotDurationMinutes;

const customerSchema = t.Object({
  firstName: t.String({ minLength: 2, error: 'Ingresa tu nombre.' }),
  lastName: t.Optional(t.String()), // opcional: el formulario solo pide nombre y teléfono
  phone: t.String({ pattern: PHONE_RE.source, error: 'Ingresa un teléfono válido (9 dígitos).' }),
  email: t.Optional(t.Union([t.Literal(''), t.String({ format: 'email', error: 'Ingresa un correo válido.' })])), // opcional
});

/** Código: DP-2026-00125 (contador atómico en la tabla counters) */
async function nextBookingCode(tx: Prisma.TransactionClient) {
  const counter = await tx.counter.upsert({ where: { key: 'booking' }, update: { value: { increment: 1 } }, create: { key: 'booking', value: 1 } });
  return `${APP_CONFIG.codePrefix}-${new Date().getFullYear()}-${String(counter.value).padStart(5, '0')}`;
}

/** Filas de availability (una por hora) para un bloque */
function slotRows(fieldId: string, date: string, block: Block) {
  const rows = [];
  for (let m = timeToMinutes(block.startTime); m < timeToMinutes(block.endTime); m += SLOT) {
    rows.push({ fieldId, date, startTime: minutesToTime(m), endTime: minutesToTime(m + SLOT), status: 'BOOKED' as const });
  }
  return rows;
}

const withField = { field: true } as const;

export const bookingRoutes = new Elysia({ prefix: '/bookings', tags: ['Reservas'] })
  .use(auth)

  .post('/', async ({ body, user }) => {
    const field = await prisma.field.findUnique({ where: { id: body.fieldId } });
    if (!field || field.status !== 'PUBLISHED' || field.approvalStatus !== 'APPROVED') throw notFound('La cancha no existe o no está disponible.');
    if (field.pricePerHour == null) throw badRequest('Esta cancha no publica su precio en línea. Contacta al local por WhatsApp o teléfono para reservar.');

    // Bloques de horario (consecutivos o no)
    const blocks: Block[] = body.slots?.length
      ? groupConsecutiveSlots(body.slots)
      : body.startTime && body.endTime ? [{ startTime: body.startTime, endTime: body.endTime }] : [];
    const hours = totalHours(blocks);
    if (!(hours >= 1) || !Number.isInteger(hours)) throw badRequest('Selecciona al menos un horario.');
    if (hours > APP_CONFIG.maxHoursPerBooking) throw badRequest(`Máximo ${APP_CONFIG.maxHoursPerBooking} horas por reserva.`);

    const today = todayISO();
    if (body.date < today) throw badRequest('No se puede reservar en una fecha pasada.');
    if (body.date > addDays(today, APP_CONFIG.daysAheadForBooking)) throw badRequest(`Solo se puede reservar hasta ${APP_CONFIG.daysAheadForBooking} días adelante.`);

    // Comprobación previa (antes de cobrar)
    const exceptions: SlotException[] = await prisma.availability.findMany({
      where: { fieldId: field.id, date: body.date },
      select: { id: true, date: true, startTime: true, status: true, bookingId: true, reason: true },
    });
    for (const b of blocks) {
      if (!areSlotsAvailable(field.schedule as Schedule, body.date, exceptions, b.startTime, b.endTime)) {
        throw conflict(`El horario ${b.startTime} - ${b.endTime} ya no está disponible. Elige otro horario.`);
      }
    }

    const totalPrice = Number(field.pricePerHour) * hours;
    const paymentMethod = body.paymentMethod || 'yape';
    const payment = await processPayment({ method: paymentMethod, amount: totalPrice, reference: `${field.id}:${body.date}` });
    if (payment.status === 'REJECTED') throw badRequest('El pago fue rechazado. Intenta con otro método.');

    try {
      const booking = await prisma.$transaction(async (tx) => {
        const bookingCode = await nextBookingCode(tx);
        return tx.booking.create({
          data: {
            bookingCode,
            userId: user?.id ?? null,
            fieldId: field.id,
            date: body.date,
            startTime: blocks[0].startTime,
            endTime: blocks[blocks.length - 1].endTime,
            slots: blocks,
            hours,
            totalPrice,
            status: 'CONFIRMED',
            customerFirstName: body.customer.firstName.trim(),
            customerLastName: (body.customer.lastName || '').trim(),
            customerPhone: body.customer.phone.trim(),
            customerEmail: (body.customer.email || '').trim().toLowerCase(),
            paymentMethod,
            paymentStatus: payment.status === 'APPROVED' ? 'PAID' : 'PENDING',
            paymentTransactionId: payment.transactionId,
            // Aquí se evita la doble reserva: UNIQUE (fieldId, date, startTime)
            availability: { createMany: { data: blocks.flatMap((b) => slotRows(field.id, body.date, b)) } },
          },
          include: withField,
        });
      });
      return serializeBooking(booking);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw conflict('Uno de los horarios elegidos acaba de ser reservado por otra persona. Elige otro horario.');
      }
      throw error;
    }
  }, {
    optionalAuth: true,
    body: t.Object({
      fieldId: t.String(),
      date: t.String({ pattern: DATE_RE.source, error: 'La fecha debe tener el formato YYYY-MM-DD.' }),
      slots: t.Optional(t.Array(t.String({ pattern: TIME_RE.source }), { description: 'Horas de inicio: ["10:00", "14:00"]' })),
      startTime: t.Optional(t.String({ pattern: TIME_RE.source })),
      endTime: t.Optional(t.String({ pattern: TIME_RE.source })),
      customer: customerSchema,
      paymentMethod: t.Optional(t.Union(PAYMENT_METHODS.map((m) => t.Literal(m)), { error: 'Método de pago no disponible.' })),
    }),
    detail: { summary: 'Crear una reserva (con o sin cuenta)' },
  })

  .get('/code/:code', async ({ params }) => {
    const booking = await prisma.booking.findUnique({ where: { bookingCode: params.code.toUpperCase() }, include: withField });
    if (!booking) throw notFound('No encontramos una reserva con ese código.');
    return serializeBooking(booking);
  }, { detail: { summary: 'Consultar una reserva por su código' } })

  /** Reservas hechas como invitado (el navegador guarda los códigos) */
  .post('/lookup', async ({ body }) => {
    const codes = body.codes.map((c) => c.toUpperCase());
    const bookings = await prisma.booking.findMany({ where: { bookingCode: { in: codes } }, include: withField, orderBy: [{ date: 'desc' }, { startTime: 'desc' }] });
    return bookings.map(serializeBooking);
  }, { body: t.Object({ codes: t.Array(t.String(), { maxItems: 100 }) }), detail: { summary: 'Reservas por lista de códigos (invitados)' } })

  /** Reservas del jugador: por su id o por su correo (las que hizo como invitado) */
  .get('/me', async ({ user }) => {
    const bookings = await prisma.booking.findMany({
      where: { OR: [{ userId: user.id }, { customerEmail: user.email }] },
      include: withField,
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    });
    return bookings.map(serializeBooking);
  }, { auth: true, detail: { summary: 'Mis reservas' } })

  .get('/:id', async ({ params, user }) => {
    const booking = await prisma.booking.findUnique({ where: { id: params.id }, include: withField });
    if (!booking) throw notFound('La reserva no existe.');
    const allowed = user.role === 'ADMIN' || booking.userId === user.id || booking.customerEmail === user.email || booking.field.ownerId === user.id;
    if (!allowed) throw forbidden();
    return serializeBooking(booking);
  }, { auth: true, detail: { summary: 'Detalle de una reserva' } })

  /**
   * Cancelar. Puede hacerlo: el jugador dueño de la reserva (por id o correo), el
   * propietario de la cancha, un administrador, o un invitado que envíe el bookingCode.
   */
  .post('/:id/cancel', async ({ params, body, user }) => {
    const booking = await prisma.booking.findUnique({ where: { id: params.id }, include: withField });
    if (!booking) throw notFound('La reserva no existe.');
    const allowed =
      (user && (user.role === 'ADMIN' || booking.userId === user.id || booking.customerEmail === user.email || booking.field.ownerId === user.id)) ||
      (body?.bookingCode && body.bookingCode.toUpperCase() === booking.bookingCode);
    if (!allowed) throw forbidden('No tienes permiso para cancelar esta reserva.');
    if (booking.status === 'CANCELLED') return serializeBooking(booking);
    if (isPastEnd(booking.date, booking.endTime)) throw badRequest('No se puede cancelar una reserva que ya ocurrió.');

    const [, updated] = await prisma.$transaction([
      prisma.availability.deleteMany({ where: { bookingId: booking.id } }), // libera los horarios
      prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED', cancelledAt: new Date() }, include: withField }),
    ]);
    return serializeBooking(updated);
  }, {
    optionalAuth: true,
    body: t.Optional(t.Object({ bookingCode: t.Optional(t.String()) })),
    detail: { summary: 'Cancelar una reserva' },
  });
