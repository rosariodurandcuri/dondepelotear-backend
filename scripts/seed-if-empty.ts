/**
 * Carga los datos iniciales (prisma/seed.ts) solo la primera vez, cuando no hay usuarios.
 * Así el despliegue automático nunca borra datos reales en reinicios posteriores.
 */
import { prisma } from '../src/lib/db.ts';

const users = await prisma.user.count();
if (users > 0) {
  console.log(`Base de datos con ${users} usuarios: no se cargan datos iniciales.`);
  process.exit(0);
}
console.log('Base de datos vacía: cargando datos iniciales…');
const { seed } = await import('../prisma/seed.ts');
await seed();
await prisma.$disconnect();
