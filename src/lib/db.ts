/**
 * CLIENTE DE BASE DE DATOS (Prisma + PostgreSQL)
 * Una sola instancia compartida por toda la API.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('Falta la variable DATABASE_URL (revisa el archivo .env).');

// DATABASE_POOL_MAX: conexiones simultáneas del pool (útil en bases con pocas conexiones)
const adapter = new PrismaPg({ connectionString, max: Number(process.env.DATABASE_POOL_MAX) || 10 });

export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
});

export { Prisma } from '../generated/prisma/client.ts';
export * from '../generated/prisma/enums.ts';
