/**
 * FAVORITOS — /favorites (requiere sesión)
 * Canchas guardadas por el jugador.
 */
import { Elysia } from 'elysia';
import { auth } from '../lib/auth.ts';
import { prisma } from '../lib/db.ts';
import { notFound } from '../lib/errors.ts';
import { loadFields, PUBLIC_FIELDS } from '../lib/fields.ts';

export const favoriteRoutes = new Elysia({ prefix: '/favorites', tags: ['Favoritos'] })
  .use(auth)
  .guard({ auth: true })

  .get('/', async ({ user }) => {
    const rows = await prisma.favorite.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    const fieldIds = rows.map((r) => r.fieldId);
    const fields = fieldIds.length ? (await loadFields({ ...PUBLIC_FIELDS, id: { in: fieldIds } })).map((i) => i.enriched) : [];
    return { fieldIds, fields };
  }, { detail: { summary: 'Mis canchas favoritas' } })

  .put('/:fieldId', async ({ user, params }) => {
    const field = await prisma.field.findUnique({ where: { id: params.fieldId }, select: { id: true } });
    if (!field) throw notFound('La cancha no existe.');
    await prisma.favorite.upsert({ where: { userId_fieldId: { userId: user.id, fieldId: field.id } }, update: {}, create: { userId: user.id, fieldId: field.id } });
    return { fieldId: field.id, favorite: true };
  }, { detail: { summary: 'Marcar favorita' } })

  .delete('/:fieldId', async ({ user, params }) => {
    await prisma.favorite.deleteMany({ where: { userId: user.id, fieldId: params.fieldId } });
    return { fieldId: params.fieldId, favorite: false };
  }, { detail: { summary: 'Quitar de favoritas' } });
