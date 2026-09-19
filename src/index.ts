/**
 * ARRANQUE DEL SERVIDOR
 *   bun run dev     → con recarga automática
 *   bun run start   → producción
 */
import { app } from './app.ts';

const port = Number(process.env.PORT) || 3000;

app.listen(port, (server) => {
  console.log(`🏟️  DondePelotear API lista en http://${server.hostname}:${server.port}`);
  console.log(`📚 Documentación: http://${server.hostname}:${server.port}/docs`);
});
