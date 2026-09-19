/**
 * UTILIDADES DE FECHAS Y HORAS
 * ----------------------------
 * Convención (igual que el frontend):
 *  - Fechas: texto "YYYY-MM-DD"
 *  - Horas:  texto "HH:MM" en 24h
 * "Hoy" y "ahora" se calculan en la zona horaria del negocio (APP_CONFIG.timezone),
 * sin importar dónde esté desplegado el servidor.
 */
import { APP_CONFIG, WEEKDAY_KEYS, type WeekdayKey } from '../config/app.ts';

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-4]):[0-5]\d$/;

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_CONFIG.timezone,
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
});

/** { date: "2026-09-16", minutes: 1230 } en la zona horaria del negocio */
export function nowLocal(now = new Date()) {
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24; // Intl puede devolver "24" a medianoche
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: hour * 60 + Number(parts.minute) };
}

export function todayISO() {
  return nowLocal().date;
}

export function nowMinutes() {
  return nowLocal().minutes;
}

/** "YYYY-MM-DD" → Date a medianoche UTC (solo para aritmética de días) */
function parseISODate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number) {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

/** Lista de los próximos N días a partir de una fecha (incluida) */
export function getNextDays(count: number, fromISO = todayISO()) {
  return Array.from({ length: count }, (_, i) => addDays(fromISO, i));
}

/** Clave del día de la semana: 'mon', 'tue', ... */
export function weekdayKey(iso: string): WeekdayKey {
  const jsDay = parseISODate(iso).getUTCDay(); // 0 = domingo
  return WEEKDAY_KEYS[(jsDay + 6) % 7];
}

export function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutes(time: string, minutes: number) {
  return minutesToTime(timeToMinutes(time) + minutes);
}

/** true si el horario (fecha + hora de inicio) ya comenzó */
export function isPastSlot(iso: string, startTime: string) {
  const { date, minutes } = nowLocal();
  if (iso < date) return true;
  if (iso > date) return false;
  return timeToMinutes(startTime) <= minutes;
}

/** true si la fecha + hora de fin ya pasó */
export function isPastEnd(iso: string, endTime: string) {
  const { date, minutes } = nowLocal();
  if (iso < date) return true;
  if (iso > date) return false;
  return timeToMinutes(endTime) <= minutes;
}

export function hoursBetween(start: string, end: string) {
  return (timeToMinutes(end) - timeToMinutes(start)) / 60;
}

export type Block = { startTime: string; endTime: string };

/**
 * Agrupa horas de inicio (ej. ['10:00','11:00','14:00']) en bloques consecutivos:
 * → [{ startTime: '10:00', endTime: '12:00' }, { startTime: '14:00', endTime: '15:00' }]
 */
export function groupConsecutiveSlots(startTimes: string[], slotMinutes = APP_CONFIG.slotDurationMinutes): Block[] {
  const sorted = [...new Set(startTimes)].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  const blocks: Block[] = [];
  sorted.forEach((start) => {
    const last = blocks[blocks.length - 1];
    if (last && timeToMinutes(last.endTime) === timeToMinutes(start)) last.endTime = addMinutes(start, slotMinutes);
    else blocks.push({ startTime: start, endTime: addMinutes(start, slotMinutes) });
  });
  return blocks;
}

export function totalHours(blocks: Block[]) {
  return blocks.reduce((sum, b) => sum + hoursBetween(b.startTime, b.endTime), 0);
}

/** Distancia aproximada en km entre dos coordenadas (fórmula de Haversine) */
export function distanceKm(a: { lat: number; lng: number } | null, b: { lat: number | null; lng: number | null } | null) {
  if (!a || !b || b.lat == null || b.lng == null) return Infinity;
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
