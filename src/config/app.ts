/**
 * CONFIGURACIÓN GENERAL Y CONSTANTES DEL DOMINIO
 * ----------------------------------------------
 * Espejo de src/config/app.js y src/config/constants.js del frontend.
 * Si cambias algo aquí (tipos de cancha, rangos de precio...), cámbialo también allá.
 */
import { COUNTRIES } from './countries.ts';

export const APP_CONFIG = {
  name: 'ChapaTuCancha',
  codePrefix: 'CTC',              // Códigos de reserva: CTC-2026-00125
  defaultCountry: 'PE' as const,
  slotDurationMinutes: 60,        // Duración de cada horario reservable
  daysAheadForBooking: 14,        // Cuántos días hacia adelante se puede reservar
  maxHoursPerBooking: 4,          // Máximo de horas por reserva
  timezone: process.env.TZ || 'America/Lima',
};

export function getCountry() {
  return COUNTRIES[APP_CONFIG.defaultCountry];
}

export const FIELD_TYPES = ['F5', 'F6', 'F7', 'F8', 'F9', 'F11'] as const;

export const SERVICES = ['lighting', 'parking', 'lockers', 'showers', 'restrooms', 'stands', 'cafeteria'] as const;

export const PAYMENT_METHODS = ['yape', 'plin', 'card', 'onsite'] as const;

/** Rangos de precio del filtro de búsqueda (en moneda local) */
export const PRICE_RANGES: Record<string, { min: number; max: number }> = {
  lt80: { min: 0, max: 79.99 },
  '80-120': { min: 80, max: 120 },
  '120-180': { min: 120.01, max: 180 },
  gt180: { min: 180.01, max: Infinity },
};

/** Calificación mínima del filtro */
export const RATING_FILTERS: Record<string, number> = { '4.5': 4.5, '4': 4, '3': 3 };

export const SORT_OPTIONS = ['recommended', 'price_asc', 'price_desc', 'rating', 'distance'] as const;

export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** Horario semanal de una cancha: { mon: { open, close, closed }, ... } */
export type DaySchedule = { open: string; close: string; closed: boolean };
export type Schedule = Partial<Record<WeekdayKey, DaySchedule>>;
