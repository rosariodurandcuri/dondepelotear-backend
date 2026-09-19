/**
 * Configuración de Prisma (v7): aquí vive la URL de la base de datos
 * y el comando de seed. dotenv carga el archivo .env para la CLI.
 */
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'bun run prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
