/**
 * RUTAS PÚBLICAS DE CANCHAS — /fields
 * Búsqueda con filtros, destacadas, detalle, horarios del día y reseñas.
 */
import { Elysia, t } from 'elysia';
import { APP_CONFIG, FIELD_TYPES, getCountry, PRICE_RANGES, RATING_FILTERS, SORT_OPTIONS } from '../config/app.ts';
import { normalize } from '../config/countries.ts';
import { findLocation, getCoordinates } from '../config/locations.ts';
import { auth } from '../lib/auth.ts';
import { prisma } from '../lib/db.ts';
import { DATE_RE, TIME_RE, addDays, distanceKm, todayISO } from '../lib/dates.ts';
import { notFound } from '../lib/errors.ts';
import { PUBLIC_FIELDS, loadField, loadFields } from '../lib/fields.ts';
import { serializeReview } from '../lib/serialize.ts';
import { buildSlots, hasAvailableSlot } from '../lib/slots.ts';

const dateParam = t.Optional(t.String({ pattern: DATE_RE.source, error: 'La fecha debe tener el formato YYYY-MM-DD.' }));

export const fieldRoutes = new Elysia({ prefix: '/fields', tags: ['Canchas'] })
  .use(auth)

  /**
   * Búsqueda principal (a nivel nacional). Todos los filtros se combinan (AND).
   * Devuelve { results, location, freeText } igual que fieldService.searchFields del frontend.
   */
  .get('/', async ({ query }) => {
    const date = query.date || todayISO();
    const services = (query.services || '').split(',').map((s) => s.trim()).filter(Boolean);

    // 1) Resolver la ubicación: selects > texto reconocido > texto libre
    let location = { department: query.department || '', province: query.province || '', district: query.district || '' };
    let freeText = (query.q || '').trim();
    if (!location.department && freeText) {
      const found = findLocation(freeText);
      if (found) {
        location = { department: found.department, province: found.province || '', district: found.district || '' };
        freeText = '';
      }
    }

    // 2) Filtros que resuelve la base de datos
    const priceRange = query.priceRange ? PRICE_RANGES[query.priceRange] : null;
    const items = await loadFields({
      ...PUBLIC_FIELDS,
      ...(location.department ? { department: { equals: location.department, mode: 'insensitive' } } : {}),
      ...(location.province ? { province: { equals: location.province, mode: 'insensitive' } } : {}),
      ...(location.district ? { district: { equals: location.district, mode: 'insensitive' } } : {}),
      ...(query.type ? { types: { has: query.type } } : {}),
      ...(priceRange ? { pricePerHour: { gte: priceRange.min, ...(Number.isFinite(priceRange.max) ? { lte: priceRange.max } : {}) } } : {}),
      ...(services.length ? { services: { hasEvery: services } } : {}),
    }, date);

    // 3) Filtros calculados (texto libre, calificación, disponibilidad)
    let results = items;
    if (freeText) {
      const q = normalize(freeText);
      results = results.filter(({ enriched: f }) => [f.name, f.address, f.district, f.province, f.department].some((v) => normalize(v).includes(q)));
    }
    const minRating = query.minRating ? RATING_FILTERS[query.minRating] : null;
    if (minRating) results = results.filter(({ enriched }) => enriched.rating >= minRating);
    if (query.strictDate) results = results.filter(({ enriched }) => enriched.availabilitySummary.availableOnDate);
    if (query.time) results = results.filter(({ schedule, exceptions }) => hasAvailableSlot(schedule, date, exceptions, query.time));
    if (query.availability === 'now') results = results.filter(({ enriched }) => enriched.availabilitySummary.availableNow);
    if (query.availability === 'today') results = results.filter(({ enriched }) => enriched.availabilitySummary.availableToday);
    if (query.availability === 'week') results = results.filter(({ enriched }) => enriched.availabilitySummary.availableThisWeek);

    // 4) Ordenar. Origen para "Más cercanas": posición del usuario > lugar buscado > centro del país
    const userPos = query.lat && query.lng ? { lat: query.lat, lng: query.lng } : null;
    const origin = userPos || getCoordinates(location) || getCountry().center;
    const fields = results.map(({ enriched }) => ({ ...enriched, distanceKm: Math.round(distanceKm(origin, { lat: enriched.latitude, lng: enriched.longitude }) * 10) / 10 }));
    type F = (typeof fields)[number];
    const score = (f: F) => f.rating * 10 + (f.availabilitySummary.availableOnDate ? 5 : 0);
    const sorters: Record<(typeof SORT_OPTIONS)[number], (a: F, b: F) => number> = {
      recommended: (a, b) => score(b) - score(a),
      // Las canchas sin precio publicado van al final
      price_asc: (a, b) => (a.pricePerHour ?? Infinity) - (b.pricePerHour ?? Infinity),
      price_desc: (a, b) => (b.pricePerHour ?? -Infinity) - (a.pricePerHour ?? -Infinity),
      rating: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
      distance: (a, b) => a.distanceKm - b.distanceKm,
    };
    fields.sort(sorters[query.sort || 'recommended']);

    return { results: fields, location, freeText, date };
  }, {
    query: t.Object({
      q: t.Optional(t.String()),
      department: t.Optional(t.String()),
      province: t.Optional(t.String()),
      district: t.Optional(t.String()),
      date: dateParam,
      type: t.Optional(t.Union(FIELD_TYPES.map((x) => t.Literal(x)))),
      time: t.Optional(t.String({ pattern: TIME_RE.source })),
      priceRange: t.Optional(t.String()),
      availability: t.Optional(t.Union([t.Literal('now'), t.Literal('today'), t.Literal('week')])),
      minRating: t.Optional(t.String()),
      services: t.Optional(t.String({ description: 'Ids separados por coma: lighting,parking' })),
      sort: t.Optional(t.Union(SORT_OPTIONS.map((s) => t.Literal(s)))),
      strictDate: t.Optional(t.BooleanString()),
      lat: t.Optional(t.Numeric()),
      lng: t.Optional(t.Numeric()),
    }),
    detail: { summary: 'Buscar canchas (filtros combinables)' },
  })

  .get('/featured', async ({ query }) => {
    const items = await loadFields(PUBLIC_FIELDS);
    return items.map((i) => i.enriched).sort((a, b) => b.rating - a.rating).slice(0, query.limit ?? 4);
  }, {
    query: t.Object({ limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })) }),
    detail: { summary: 'Canchas destacadas (mejor calificadas)' },
  })

  .get('/:id', async ({ params, query, user }) => {
    const item = await loadField(params.id, query.date);
    if (!item) throw notFound('La cancha no existe.');
    const f = item.enriched;
    // Las canchas ocultas o no aprobadas solo las ve su propietario o un administrador
    const isPublic = f.status === 'PUBLISHED' && f.approvalStatus === 'APPROVED';
    if (!isPublic && !(user && (user.id === f.ownerId || user.role === 'ADMIN'))) throw notFound('La cancha no existe.');
    return f;
  }, { optionalAuth: true, query: t.Object({ date: dateParam }), detail: { summary: 'Detalle de una cancha' } })

  /** Horarios de un día: [{ startTime, endTime, status, ... }] */
  .get('/:id/slots', async ({ params, query }) => {
    const field = await prisma.field.findUnique({ where: { id: params.id }, select: { schedule: true } });
    if (!field) throw notFound('La cancha no existe.');
    const date = query.date || todayISO();
    const exceptions = await prisma.availability.findMany({
      where: { fieldId: params.id, date },
      select: { id: true, date: true, startTime: true, status: true, bookingId: true, reason: true },
    });
    return { date, slots: buildSlots(field.schedule as never, date, exceptions) };
  }, { query: t.Object({ date: dateParam }), detail: { summary: 'Horarios de una cancha para una fecha' } })

  /** Disponibilidad de varios días de una vez (calendario del propietario / selector de fechas) */
  .get('/:id/calendar', async ({ params, query }) => {
    const field = await prisma.field.findUnique({ where: { id: params.id }, select: { schedule: true } });
    if (!field) throw notFound('La cancha no existe.');
    const from = query.from || todayISO();
    const days = Math.min(query.days ?? APP_CONFIG.daysAheadForBooking, 60);
    const to = addDays(from, days - 1);
    const exceptions = await prisma.availability.findMany({
      where: { fieldId: params.id, date: { gte: from, lte: to } },
      select: { id: true, date: true, startTime: true, status: true, bookingId: true, reason: true },
    });
    const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
    return dates.map((date) => ({ date, slots: buildSlots(field.schedule as never, date, exceptions) }));
  }, {
    query: t.Object({ from: dateParam, days: t.Optional(t.Numeric({ minimum: 1, maximum: 60 })) }),
    detail: { summary: 'Horarios de varios días' },
  })

  .get('/:id/reviews', async ({ params }) => {
    const reviews = await prisma.review.findMany({ where: { fieldId: params.id }, include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
    return reviews.map(serializeReview);
  }, { detail: { summary: 'Reseñas de una cancha' } })

  /** Una reseña por usuario y cancha: si vuelve a calificar, se actualiza la anterior */
  .post('/:id/reviews', async ({ params, body, user }) => {
    const field = await prisma.field.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!field) throw notFound('La cancha no existe.');
    const data = { rating: body.rating, comment: (body.comment || '').trim().slice(0, 500), createdAt: new Date() };
    const existing = await prisma.review.findFirst({ where: { fieldId: field.id, userId: user.id } });
    const review = existing
      ? await prisma.review.update({ where: { id: existing.id }, data, include: { user: { select: { name: true } } } })
      : await prisma.review.create({ data: { ...data, fieldId: field.id, userId: user.id }, include: { user: { select: { name: true } } } });
    return serializeReview(review);
  }, {
    auth: true,
    body: t.Object({ rating: t.Integer({ minimum: 1, maximum: 5, error: 'Elige una calificación de 1 a 5 estrellas.' }), comment: t.Optional(t.String({ maxLength: 1000 })) }),
    detail: { summary: 'Publicar una reseña' },
  });
