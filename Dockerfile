# Imagen de producción de la API (Bun + Prisma). La usa Coolify para desplegar.
FROM oven/bun:1

WORKDIR /app

# Dependencias (incluye prisma CLI, necesario para generar el cliente y migrar)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Código y generación del cliente de Prisma (src/generated no está en git)
COPY . .
RUN bunx prisma generate

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Aplica migraciones, carga datos iniciales si la base está vacía y arranca la API
CMD ["sh", "scripts/start.sh"]
