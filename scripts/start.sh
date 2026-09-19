#!/bin/sh
# Arranque en producción:
#  1. Aplica las migraciones pendientes.
#  2. Si la base de datos está vacía (sin usuarios), carga los datos iniciales.
#  3. Inicia la API.
set -e
bun run db:deploy
bun run scripts/seed-if-empty.ts
exec bun run start
