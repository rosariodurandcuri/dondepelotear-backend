/**
 * DISPONIBILIDAD (corazón del sistema de reservas)
 * ------------------------------------------------
 *  1. Cada cancha tiene un horario semanal (field.schedule). De él se generan
 *     los horarios de 1 hora.
 *  2. La tabla `availability` solo guarda EXCEPCIONES: BOOKED o BLOCKED.
 *  3. Todo horario dentro del horario de atención sin excepción está AVAILABLE;
 *     los que ya pasaron se marcan PAST.
 */
import { APP_CONFIG, type Schedule } from '../config/app.ts';
import { getNextDays, isPastSlot, minutesToTime, nowLocal, timeToMinutes, todayISO, weekdayKey } from './dates.ts';
import type { SlotStatus } from './db.ts';

const SLOT_MINUTES = APP_CONFIG.slotDurationMinutes;

export type SlotException = {
  id: string;
  date: string;
  startTime: string;
  status: SlotStatus;
  bookingId: string | null;
  reason: string | null;
};

export type Slot = {
  startTime: string;
  endTime: string;
  status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED' | 'PAST';
  bookingId: string | null;
  reason: string | null;
  availabilityId: string | null;
};

/** Horarios de una cancha para una fecha, a partir de su horario semanal y sus excepciones */
export function buildSlots(schedule: Schedule | null | undefined, date: string, exceptions: SlotException[]): Slot[] {
  const day = schedule?.[weekdayKey(date)];
  if (!day || day.closed || !day.open || !day.close) return [];

  const slots: Slot[] = [];
  const open = timeToMinutes(day.open);
  const close = timeToMinutes(day.close);
  const forDate = exceptions.filter((e) => e.date === date);

  for (let start = open; start + SLOT_MINUTES <= close; start += SLOT_MINUTES) {
    const startTime = minutesToTime(start);
    const exception = forDate.find((e) => e.startTime === startTime);
    let status: Slot['status'] = 'AVAILABLE';
    if (exception) status = exception.status;
    else if (isPastSlot(date, startTime)) status = 'PAST';
    slots.push({
      startTime,
      endTime: minutesToTime(start + SLOT_MINUTES),
      status,
      bookingId: exception?.bookingId ?? null,
      reason: exception?.reason ?? null,
      availabilityId: exception?.id ?? null,
    });
  }
  return slots;
}

/** true si hay al menos un horario disponible en la fecha (opcionalmente a una hora exacta) */
export function hasAvailableSlot(schedule: Schedule | null | undefined, date: string, exceptions: SlotException[], time?: string | null) {
  return buildSlots(schedule, date, exceptions).some((s) => s.status === 'AVAILABLE' && (!time || s.startTime === time));
}

/** Resumen de disponibilidad de una cancha (para tarjetas y filtros) */
export function getAvailabilitySummary(schedule: Schedule | null | undefined, exceptions: SlotException[], date = todayISO()) {
  const today = todayISO();
  const { minutes } = nowLocal();
  const availableNow = buildSlots(schedule, today, exceptions).some(
    (s) => s.status === 'AVAILABLE' && timeToMinutes(s.startTime) <= minutes + 60 // dentro de la próxima hora
  );
  return {
    availableNow,
    availableToday: hasAvailableSlot(schedule, today, exceptions),
    availableOnDate: hasAvailableSlot(schedule, date, exceptions),
    availableThisWeek: getNextDays(7).some((d) => hasAvailableSlot(schedule, d, exceptions)),
  };
}

/** Comprueba que TODOS los horarios entre start y end estén disponibles */
export function areSlotsAvailable(schedule: Schedule | null | undefined, date: string, exceptions: SlotException[], startTime: string, endTime: string) {
  const slots = buildSlots(schedule, date, exceptions);
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const needed = slots.filter((s) => timeToMinutes(s.startTime) >= start && timeToMinutes(s.startTime) < end);
  const expectedCount = (end - start) / SLOT_MINUTES;
  return needed.length === expectedCount && needed.every((s) => s.status === 'AVAILABLE');
}
