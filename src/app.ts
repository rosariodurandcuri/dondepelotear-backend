/**
 * APLICACIÓN ELYSIA
 * -----------------
 * Une los plugins (CORS, OpenAPI), el manejo global de errores y las rutas.
 * Se separa de index.ts para poder usar `app.handle(request)` en pruebas.
 */
import { cors } from '@elysiajs/cors';
import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { APP_CONFIG } from './config/app.ts';
import { prisma } from './lib/db.ts';
import { AppError } from './lib/errors.ts';
import { adminRoutes } from './routes/admin.ts';
import { authRoutes } from './routes/auth.ts';
import { bookingRoutes } from './routes/bookings.ts';
import { favoriteRoutes } from './routes/favorites.ts';
import { fieldRoutes } from './routes/fields.ts';
import { ownerRoutes } from './routes/owner.ts';

const origins = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);

export const app = new Elysia()
  .use(cors({ origin: origins.length ? origins : true }))
  .use(openapi({
    path: '/docs',
    documentation: {
      info: { title: `${APP_CONFIG.name} API`, version: '1.0.0', description: 'API de reserva de canchas de fútbol. Envía el token en `Authorization: Bearer <token>`.' },
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
      security: [{ bearerAuth: [] }],
    },
  }))

  // Todas las respuestas de error tienen la forma { error: "mensaje" }
  .onError(({ error, code, set }) => {
    if (error instanceof AppError) {
      set.status = error.status;
      return { error: error.message };
    }
    if (code === 'VALIDATION') {
      set.status = 400;
      const first = error.all?.find((e) => 'schema' in e && e.schema?.error) as { schema?: { error?: string } } | undefined;
      const detail = error.all?.[0] && 'path' in error.all[0] ? `${error.all[0].path.replace(/^\//, '') || error.type}: ${error.all[0].message}` : error.message;
      return { error: first?.schema?.error || `Datos inválidos (${detail}).` };
    }
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'Ruta no encontrada.' };
    }
    if (code === 'PARSE') {
      set.status = 400;
      return { error: 'El cuerpo de la petición no es JSON válido.' };
    }
    console.error(error);
    set.status = 500;
    return { error: 'Error interno del servidor.' };
  })

  .get('/', () => ({ name: `${APP_CONFIG.name} API`, docs: '/docs', health: '/health' }), { detail: { tags: ['Sistema'], summary: 'Bienvenida' } })
  .get('/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, database: 'up', time: new Date().toISOString() };
  }, { detail: { tags: ['Sistema'], summary: 'Estado del servidor y la base de datos' } })

  .use(authRoutes)
  .use(fieldRoutes)
  .use(bookingRoutes)
  .use(ownerRoutes)
  .use(favoriteRoutes)
  .use(adminRoutes);

export type App = typeof app;
