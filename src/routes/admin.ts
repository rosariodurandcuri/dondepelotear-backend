/**
 * ADMINISTRACIÓN — /admin (rol ADMIN)
 * Base para el panel: ver todo, aprobar/rechazar y ocultar canchas, cambiar roles.
 */
import { Elysia, t } from 'elysia';
import { auth } from '../lib/auth.ts';
import { prisma } from '../lib/db.ts';
import { notFound } from '../lib/errors.ts';
import { serializeBooking, serializeField, serializeUser } from '../lib/serialize.ts';

export const adminRoutes = new Elysia({ prefix: '/admin', tags: ['Administración'] })
  .use(auth)
  .guard({ auth: ['ADMIN'] })

  .get('/fields', async () => {
    const fields = await prisma.field.findMany({ include: { owner: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' } });
    return fields.map(({ owner, ...f }) => ({ ...serializeField(f), ownerName: owner.name, ownerEmail: owner.email }));
  }, { detail: { summary: 'Todas las canchas' } })

  .patch('/fields/:id/approval', async ({ params, body }) => {
    if (!(await prisma.field.findUnique({ where: { id: params.id }, select: { id: true } }))) throw notFound('La cancha no existe.');
    return serializeField(await prisma.field.update({ where: { id: params.id }, data: { approvalStatus: body.approvalStatus } }));
  }, { body: t.Object({ approvalStatus: t.Union([t.Literal('PENDING'), t.Literal('APPROVED'), t.Literal('REJECTED')]) }), detail: { summary: 'Aprobar / rechazar una cancha' } })

  .patch('/fields/:id/status', async ({ params, body }) => {
    if (!(await prisma.field.findUnique({ where: { id: params.id }, select: { id: true } }))) throw notFound('La cancha no existe.');
    return serializeField(await prisma.field.update({ where: { id: params.id }, data: { status: body.status } }));
  }, { body: t.Object({ status: t.Union([t.Literal('DRAFT'), t.Literal('PUBLISHED'), t.Literal('HIDDEN')]) }), detail: { summary: 'Publicar / ocultar una cancha' } })

  .get('/bookings', async () => {
    const bookings = await prisma.booking.findMany({ include: { field: true }, orderBy: { createdAt: 'desc' }, take: 500 });
    return bookings.map(serializeBooking);
  }, { detail: { summary: 'Todas las reservas' } })

  .get('/users', async () => (await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })).map(serializeUser), { detail: { summary: 'Todos los usuarios' } })

  .patch('/users/:id/role', async ({ params, body }) => {
    if (!(await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } }))) throw notFound('El usuario no existe.');
    return serializeUser(await prisma.user.update({ where: { id: params.id }, data: { role: body.role } }));
  }, { body: t.Object({ role: t.Union([t.Literal('PLAYER'), t.Literal('OWNER'), t.Literal('ADMIN')]) }), detail: { summary: 'Cambiar el rol de un usuario' } })

  .get('/stats', async () => {
    const [users, fields, pendingFields, bookings, revenue] = await Promise.all([
      prisma.user.count(),
      prisma.field.count(),
      prisma.field.count({ where: { approvalStatus: 'PENDING' } }),
      prisma.booking.count({ where: { status: { not: 'CANCELLED' } } }),
      prisma.booking.aggregate({ _sum: { totalPrice: true }, where: { status: { not: 'CANCELLED' }, paymentStatus: 'PAID' } }),
    ]);
    return { users, fields, pendingFields, bookings, revenue: Number(revenue._sum.totalPrice ?? 0) };
  }, { detail: { summary: 'Resumen general' } });
