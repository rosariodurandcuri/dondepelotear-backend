/**
 * CONFIGURACIÓN POR PAÍS (moneda, teléfono, zona horaria)
 */
export const COUNTRIES = {
  PE: {
    code: 'PE',
    name: 'Perú',
    currency: 'PEN',
    currencySymbol: 'S/',
    locale: 'es-PE',
    phoneCode: '+51',
    timezone: 'America/Lima',
    /** Centro por defecto para ordenar por distancia cuando no hay ubicación elegida */
    center: { lat: -12.0464, lng: -77.0428 },
  },
} as const;

export type CountryCode = keyof typeof COUNTRIES;

/** Quita acentos y mayúsculas para comparar textos: "Áncash" → "ancash" */
export function normalize(text: unknown = ''): string {
  return String(text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
