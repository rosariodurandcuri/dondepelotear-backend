/**
 * RUTAS DE AUTENTICACIÓN — /auth
 */
import { Elysia, t } from 'elysia';
import { auth, hashPassword, signToken, verifyPassword } from '../lib/auth.ts';
import { prisma } from '../lib/db.ts';
import { badRequest, conflict, unauthorized } from '../lib/errors.ts';
import { serializeUser } from '../lib/serialize.ts';

const email = t.String({ format: 'email', error: 'Ingresa un correo válido.' });
const password = t.String({ minLength: 6, error: 'La contraseña debe tener al menos 6 caracteres.' });
const registerRole = t.Optional(t.Union([t.Literal('player'), t.Literal('owner')], { error: 'Rol inválido.' })); // nadie se registra como admin
const WHATSAPP_RE = /^\+?\d[\d\s-]{7,14}$/;

async function session(user: Parameters<typeof serializeUser>[0]) {
  return { token: await signToken(user.id), user: serializeUser(user) };
}

export const authRoutes = new Elysia({ prefix: '/auth', tags: ['Auth'] })
  .use(auth)

  .post('/register', async ({ body }) => {
    const normalizedEmail = body.email.toLowerCase().trim();
    if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) throw conflict('Ya existe una cuenta con ese correo. Inicia sesión.');
    const user = await prisma.user.create({
      data: {
        name: body.name.trim(),
        email: normalizedEmail,
        passwordHash: await hashPassword(body.password),
        phone: (body.phone || '').trim(),
        role: body.role === 'owner' ? 'OWNER' : 'PLAYER',
      },
    });
    return session(user);
  }, {
    body: t.Object({
      name: t.String({ minLength: 3, error: 'Ingresa tu nombre completo.' }),
      email,
      password,
      phone: t.Optional(t.String()),
      role: registerRole,
    }),
    detail: { summary: 'Crear cuenta (jugador o propietario)' },
  })

  .post('/login', async ({ body }) => {
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase().trim() } });
    if (!user) throw unauthorized('No encontramos una cuenta con ese correo. ¿Quieres registrarte?');
    if (!user.passwordHash) throw unauthorized('Esta cuenta se creó con Google/Facebook. Usa ese método para entrar.');
    if (!(await verifyPassword(body.password, user.passwordHash))) throw unauthorized('Contraseña incorrecta.');
    return session(user);
  }, {
    body: t.Object({ email, password: t.String({ minLength: 1, error: 'Ingresa tu contraseña.' }) }),
    detail: { summary: 'Iniciar sesión' },
  })

  /**
   * Acceso con Google / Facebook (SIMULADO, igual que el MVP).
   * En producción: verificar el id_token del proveedor y tomar nombre + correo de ahí.
   */
  .post('/provider', async ({ body }) => {
    const providers = { google: 'Google', facebook: 'Facebook' } as const;
    const label = providers[body.provider];
    const providerEmail = `usuario.${body.provider}@demo.com`;
    const user = await prisma.user.upsert({
      where: { email: providerEmail },
      update: {},
      create: { name: `Usuario ${label}`, email: providerEmail, provider: body.provider, role: body.role === 'owner' ? 'OWNER' : 'PLAYER' },
    });
    return session(user);
  }, {
    body: t.Object({ provider: t.Union([t.Literal('google'), t.Literal('facebook')], { error: 'Proveedor no disponible.' }), role: registerRole }),
    detail: { summary: 'Entrar con Google/Facebook (simulado)' },
  })

  .get('/me', ({ user }) => serializeUser(user), { auth: true, detail: { summary: 'Usuario con sesión' } })

  .patch('/me', async ({ user, body }) => {
    if (body.whatsapp && !WHATSAPP_RE.test(body.whatsapp.trim())) throw badRequest('Ingresa un número de WhatsApp válido (9 dígitos).');
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.phone !== undefined ? { phone: body.phone.trim() } : {}),
        ...(body.whatsapp !== undefined ? { whatsapp: body.whatsapp.trim() } : {}),
      },
    });
    return serializeUser(updated);
  }, {
    auth: true,
    body: t.Object({
      name: t.Optional(t.String({ minLength: 3, error: 'Ingresa tu nombre completo.' })),
      phone: t.Optional(t.String()),
      whatsapp: t.Optional(t.String()),
    }),
    detail: { summary: 'Editar perfil (nombre, teléfono, WhatsApp)' },
  })

  .patch('/me/password', async ({ user, body }) => {
    if (user.passwordHash && !(await verifyPassword(body.currentPassword || '', user.passwordHash))) throw unauthorized('La contraseña actual es incorrecta.');
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } });
    return { ok: true };
  }, {
    auth: true,
    body: t.Object({ currentPassword: t.Optional(t.String()), newPassword: password }),
    detail: { summary: 'Cambiar contraseña' },
  });
