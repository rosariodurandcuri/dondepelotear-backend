/**
 * CANCHAS: carga y enriquecimiento
 * Agrega a cada cancha su calificación, resumen de disponibilidad y WhatsApp de
 * contacto (el de la cancha o, si no tiene, el del propietario).
 */
import type { Schedule } from '../config/app.ts';
import { prisma, type Prisma } from './db.ts';
import { todayISO } from './dates.ts';
import { serializeField } from './serialize.ts';
import { getAvailabilitySummary, type SlotException } from './slots.ts';

const includeForEnrich = (fromDate: string) => ({
  owner: { select: { name: true, whatsapp: true, phone: true } },
  reviews: { select: { rating: true } },
  availability: {
    where: { date: { gte: fromDate } },
    select: { id: true, date: true, startTime: true, status: true, bookingId: true, reason: true },
  },
});

type FieldRow = Prisma.FieldGetPayload<{ include: ReturnType<typeof includeForEnrich> }>;

export function ratingSummary(reviews: { rating: number }[]) {
  if (!reviews.length) return { rating: 0, reviewCount: 0 };
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return { rating: Math.round((total / reviews.length) * 10) / 10, reviewCount: reviews.length };
}

export function enrichField(row: FieldRow, date = todayISO()) {
  const { owner, reviews, availability, ...field } = row;
  const schedule = field.schedule as Schedule;
  const exceptions: SlotException[] = availability;
  return {
    ...serializeField(field),
    ...ratingSummary(reviews),
    availabilitySummary: getAvailabilitySummary(schedule, exceptions, date),
    contactWhatsApp: field.whatsapp || owner.whatsapp || owner.phone || '',
    ownerName: owner.name,
  };
}

export type EnrichedField = ReturnType<typeof enrichField>;

/** Canchas que cumplen `where`, enriquecidas. Devuelve también las excepciones para filtros por hora. */
export async function loadFields(where: Prisma.FieldWhereInput, date = todayISO()) {
  const today = todayISO();
  const rows = await prisma.field.findMany({ where, include: includeForEnrich(date < today ? date : today) });
  return rows.map((row) => ({ enriched: enrichField(row, date), schedule: row.schedule as Schedule, exceptions: row.availability as SlotException[] }));
}

export async function loadField(id: string, date = todayISO()) {
  const [item] = await loadFields({ id }, date);
  return item ?? null;
}

/** Filtro de canchas visibles para el público */
export const PUBLIC_FIELDS: Prisma.FieldWhereInput = { status: 'PUBLISHED', approvalStatus: 'APPROVED' };
