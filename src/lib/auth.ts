/**
 * AUTENTICACIÓN (JWT + contraseñas)
 * ---------------------------------
 * - Las contraseñas se guardan con hash (Bun.password → argon2id).
 * - La sesión es un token JWT firmado con JWT_SECRET, enviado por el frontend en
 *   la cabecera `Authorization: Bearer <token>`.
 * - `auth` es un plugin de Elysia que agrega el usuario al contexto de la ruta:
 *     .get('/me', ({ user }) => user, { auth: true })              → requiere sesión
 *     .get('/panel', handler, { auth: ['OWNER', 'ADMIN'] })       → requiere rol
 *     .post('/bookings', handler, { optionalAuth: true })         → user puede ser null
 */
import { Elysia } from 'elysia';
import { SignJWT, jwtVerify } from 'jose';
import { prisma, type Role } from './db.ts';
import { forbidden, unauthorized } from './errors.ts';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  console.warn('⚠️  JWT_SECRET no está definido o es muy corto. Define uno largo en .env antes de ir a producción.');
}
const secret = new TextEncoder().encode(JWT_SECRET || 'canchaya-dev-secret-inseguro');
const TOKEN_TTL = '30d';

export function signToken(userId: string) {
  return new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime(TOKEN_TTL).sign(secret);
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export const hashPassword = (password: string) => Bun.password.hash(password);
export const verifyPassword = (password: string, hash: string) => Bun.password.verify(password, hash);

async function userFromHeaders(headers: Record<string, string | undefined>) {
  const header = headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const userId = await verifyToken(header.slice(7).trim());
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

export type AuthUser = NonNullable<Awaited<ReturnType<typeof userFromHeaders>>>;

export const auth = new Elysia({ name: 'auth' }).macro({
  auth: (roles: true | Role[]) => ({
    async resolve({ headers }) {
      const user = await userFromHeaders(headers);
      if (!user) throw unauthorized();
      if (roles !== true && !roles.includes(user.role)) throw forbidden();
      return { user };
    },
  }),
  optionalAuth: {
    async resolve({ headers }) {
      return { user: await userFromHeaders(headers) };
    },
  },
});
