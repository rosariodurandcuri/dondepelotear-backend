# DondePelotear — API (backend)

Backend de la plataforma: **Bun** (runtime) + **Elysia** (servidor HTTP) + **Prisma** (ORM) + **PostgreSQL** (base de datos).

```
server/
  prisma/
    schema.prisma       Tablas y relaciones (users, fields, availability, bookings, reviews, favorites, counters)
    migrations/         Historial de cambios de la base de datos (SQL)
    data/canchas-peru.json  167 canchas reales del Perú (directorios públicos)
    seed.ts             Carga las canchas reales, cuentas de prueba y reservas de ejemplo
  prisma.config.ts      Configuración de Prisma (lee DATABASE_URL del .env)
  docker-compose.yml    PostgreSQL local con Docker
  src/
    index.ts            Arranque del servidor
    app.ts              Elysia: CORS, OpenAPI, manejo de errores y rutas
    config/             Constantes del dominio, países y ubicaciones del Perú
    lib/
      db.ts             Cliente de Prisma
      auth.ts           JWT, contraseñas y el plugin `auth` para proteger rutas
      slots.ts          Cálculo de horarios disponibles (corazón de las reservas)
      fields.ts         Carga de canchas con calificación, disponibilidad y WhatsApp
      dates.ts          Fechas "YYYY-MM-DD" y horas "HH:MM" en la zona horaria del negocio
      payments.ts       Pago simulado (aquí se integra Mercado Pago / Culqi / Niubiz)
      serialize.ts      Formato JSON que espera el frontend
      errors.ts         AppError → respuestas { error: "mensaje" }
    routes/             auth, fields, bookings, owner, favorites, admin
  tests/api.e2e.ts      Pruebas de extremo a extremo (54 comprobaciones)
```

## Requisitos

- [Bun](https://bun.sh) ≥ 1.2 → `curl -fsSL https://bun.sh/install | bash`
- PostgreSQL 14+ (cualquiera de estas opciones):
  - **Docker**: `docker compose up -d` dentro de `server/` (usuario/clave/BD: `canchaya`)
  - [Postgres.app](https://postgresapp.com) en macOS, o `brew install postgresql@16`
  - Una base en la nube: [Neon](https://neon.tech), [Supabase](https://supabase.com), Railway… (copia su URL en `.env`)

## Puesta en marcha

```bash
cd server
cp .env.example .env        # edita DATABASE_URL y JWT_SECRET
bun install
bun run db:migrate          # crea las tablas (usa las migraciones de prisma/migrations)
bun run db:seed             # carga canchas, usuarios y reservas de prueba
bun run dev                 # API en http://localhost:3000 (recarga automática)
```

- Documentación interactiva (OpenAPI): **http://localhost:3000/docs**
- Estado: `GET /health`

Todas las cuentas de prueba (`jugador@demo.com`, `propietario@demo.com`, `admin@demo.com`, …) usan la contraseña **`demo1234`**.

## Datos

`bun run db:seed` carga `prisma/data/canchas-peru.json`: 167 locales reales (35 con precio publicado). Los propietarios demo administran algunas canchas de su ciudad para probar el panel; el resto queda bajo `directorio@demo.com`. Las canchas con `pricePerHour: null` se muestran como "Consultar precio" y la API no permite reservarlas en línea (`POST /bookings` → 400). No se generan reseñas ficticias.

## Scripts

| Comando               | Qué hace                                                        |
|-----------------------|-----------------------------------------------------------------|
| `bun run dev`         | Servidor con recarga automática                                 |
| `bun run start`       | Servidor (producción)                                           |
| `bun run db:migrate`  | Crea/aplica migraciones en desarrollo (`prisma migrate dev`)    |
| `bun run db:deploy`   | Aplica migraciones en producción (`prisma migrate deploy`)      |
| `bun run db:seed`     | Borra todo y carga las canchas reales + cuentas de prueba       |
| `bun run db:reset`    | Recrea la base desde cero + seed                                |
| `bun run db:studio`   | Interfaz visual para ver/editar la base de datos                |
| `bun run db:generate` | Regenera el cliente de Prisma tras cambiar `schema.prisma`      |
| `bun run typecheck`   | Comprueba los tipos de TypeScript                               |
| `bun run test:e2e`    | Pruebas contra la API en marcha (tras `db:seed`)                |

## Variables de entorno (`.env`)

| Variable            | Descripción                                                    |
|---------------------|----------------------------------------------------------------|
| `DATABASE_URL`      | Conexión a PostgreSQL                                          |
| `JWT_SECRET`        | Clave para firmar los tokens de sesión (larga y secreta)       |
| `PORT`              | Puerto de la API (3000)                                        |
| `CORS_ORIGINS`      | Orígenes permitidos separados por coma (vacío = todos)         |
| `TZ`                | Zona horaria del negocio (`America/Lima`)                      |
| `DATABASE_POOL_MAX` | Conexiones máximas del pool (opcional, por defecto 10)         |

## Rutas

Autenticación: el login devuelve `{ token, user }`; envía el token en la cabecera `Authorization: Bearer <token>`.
Roles: `player`, `owner`, `admin` (el admin puede hacer todo lo que hace un propietario).

| Método | Ruta                             | Quién        | Descripción                                             |
|--------|----------------------------------|--------------|---------------------------------------------------------|
| POST   | `/auth/register`                 | público      | Crear cuenta (`role`: `player` o `owner`)               |
| POST   | `/auth/login`                    | público      | Iniciar sesión                                          |
| POST   | `/auth/provider`                 | público      | Google/Facebook (simulado)                              |
| GET    | `/auth/me`                       | sesión       | Usuario actual                                          |
| PATCH  | `/auth/me`                       | sesión       | Editar nombre, teléfono, WhatsApp                       |
| PATCH  | `/auth/me/password`              | sesión       | Cambiar contraseña                                      |
| GET    | `/fields`                        | público      | Búsqueda con filtros (ver abajo)                        |
| GET    | `/fields/featured?limit=4`       | público      | Destacadas                                              |
| GET    | `/fields/:id`                    | público      | Detalle (calificación, disponibilidad, WhatsApp)        |
| GET    | `/fields/:id/slots?date=`        | público      | Horarios de un día                                      |
| GET    | `/fields/:id/calendar?from=&days=` | público    | Horarios de varios días                                 |
| GET    | `/fields/:id/reviews`            | público      | Reseñas                                                 |
| POST   | `/fields/:id/reviews`            | sesión       | Publicar reseña (solo si reservó allí)                  |
| POST   | `/bookings`                      | opcional     | Reservar (`slots: ["10:00","14:00"]` o `startTime/endTime`) |
| GET    | `/bookings/code/:code`           | público      | Consultar por código `DP-2026-00125`                    |
| POST   | `/bookings/lookup`               | público      | Varias reservas por código (invitados)                  |
| GET    | `/bookings/me`                   | sesión       | Mis reservas (por cuenta o por correo)                  |
| GET    | `/bookings/:id`                  | sesión       | Detalle                                                 |
| POST   | `/bookings/:id/cancel`           | opcional     | Cancelar (dueño, propietario, admin o invitado con `bookingCode`) |
| GET    | `/favorites`                     | sesión       | Favoritas                                               |
| PUT/DELETE | `/favorites/:fieldId`        | sesión       | Marcar / quitar                                         |
| GET    | `/owner/fields`                  | owner        | Mis canchas                                             |
| POST   | `/owner/fields`                  | owner        | Publicar cancha                                         |
| PATCH  | `/owner/fields/:id`              | owner        | Editar                                                  |
| PATCH  | `/owner/fields/:id/status`       | owner        | Publicar / ocultar                                      |
| DELETE | `/owner/fields/:id`              | owner        | Eliminar (si no tiene reservas próximas)                |
| POST/DELETE | `/owner/fields/:id/blocks`  | owner        | Bloquear / desbloquear un horario                       |
| GET    | `/owner/bookings?fieldId=&date=` | owner        | Reservas recibidas                                      |
| GET    | `/owner/stats`                   | owner        | Estadísticas del panel                                  |
| GET    | `/admin/stats` `/fields` `/bookings` `/users` | admin | Vista global                                    |
| PATCH  | `/admin/fields/:id/approval`     | admin        | Aprobar / rechazar                                      |
| PATCH  | `/admin/fields/:id/status`       | admin        | Publicar / ocultar                                      |
| PATCH  | `/admin/users/:id/role`          | admin        | Cambiar rol                                             |

**Filtros de `GET /fields`** (se combinan con AND): `q` (texto libre: "Lima", "san miguel"), `department`, `province`, `district`, `date`, `type` (F5…F11), `time` (HH:MM), `priceRange` (`lt80`, `80-120`, `120-180`, `gt180`), `availability` (`now`, `today`, `week`), `minRating` (`4.5`, `4`, `3`), `services` (`lighting,parking`), `sort` (`recommended`, `price_asc`, `price_desc`, `rating`, `distance`), `strictDate`, `lat`, `lng`.

Los errores siempre responden `{ "error": "mensaje en español" }` con el código HTTP correspondiente (400 datos inválidos, 401 sin sesión, 403 sin permiso, 404 no existe, 409 conflicto — p. ej. horario ya reservado).

## Cómo se evita la doble reserva

La tabla `availability` tiene la restricción `UNIQUE (fieldId, date, startTime)`. Al reservar, la reserva y sus filas de `availability` se insertan en **una transacción**: si dos personas intentan el mismo horario al mismo tiempo, la base de datos solo deja pasar a una y la otra recibe `409`.

## Conectar el frontend

Los servicios del frontend (`src/services/*.js`) ya son asíncronos; basta con reemplazar las lecturas de `localStorage` (`storage.js`) por `fetch` a estas rutas, guardar el `token` del login y enviarlo en `Authorization`. El formato de los datos es el mismo (`role` en minúscula, `customer` como objeto, `slots` como bloques, etc.).

## Producción

1. `bun run db:deploy` (aplica migraciones sin preguntar) y luego `bun run start`.
2. Define `JWT_SECRET` largo, `CORS_ORIGINS` con el dominio del frontend y `NODE_ENV=production`.
3. Para pagos reales, implementa `src/lib/payments.ts` con el proveedor elegido.
