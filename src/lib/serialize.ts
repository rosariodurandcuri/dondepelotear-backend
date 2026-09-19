/**
 * SERIALIZACIÓN
 * Convierte las filas de Prisma al formato JSON que espera el frontend
 * (roles en minúscula, precios como número, cliente como objeto, etc.).
 */
import type { Booking, Field, Review, User } from '../generated/prisma/client.ts';
import { isPastEnd } from './dates.ts';

export function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    whatsapp: user.whatsapp,
    role: user.role.toLowerCase() as 'player' | 'owner' | 'admin',
    provider: user.provider,
    createdAt: user.createdAt,
  };
}

export function serializeField(field: Field) {
  return {
    ...field,
    type: field.types[0] ?? null, // tipo principal (compatibilidad)
    pricePerHour: field.pricePerHour == null ? null : Number(field.pricePerHour), // null = precio no publicado
    priceMax: field.priceMax == null ? null : Number(field.priceMax),
  };
}

export type SerializedField = ReturnType<typeof serializeField>;

/** Una reserva confirmada cuya hora ya pasó se muestra como Completada */
export function displayStatus(booking: Pick<Booking, 'status' | 'date' | 'endTime'>) {
  if (booking.status === 'CONFIRMED' && isPastEnd(booking.date, booking.endTime)) return 'COMPLETED';
  return booking.status;
}

export function serializeBooking(booking: Booking & { field?: Field | null }) {
  const { customerFirstName, customerLastName, customerPhone, customerEmail, field, ...rest } = booking;
  return {
    ...rest,
    totalPrice: Number(booking.totalPrice),
    customer: { firstName: customerFirstName, lastName: customerLastName, phone: customerPhone, email: customerEmail },
    displayStatus: displayStatus(booking),
    field: field ? serializeField(field) : undefined,
  };
}

export function serializeReview(review: Review & { user?: Pick<User, 'name'> | null }) {
  const { user, ...rest } = review;
  return { ...rest, userName: user?.name || 'Jugador' };
}
