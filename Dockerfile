# Multi-stage Dockerfile for NextGen Fusion School
FROM oven/bun:1.2-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.2-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:1.2-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/db/migrations ./src/db/migrations
COPY --from=build /app/src/db/schema.ts ./src/db/schema.ts
EXPOSE 8080
# Apply migrations then start the server
CMD ["sh", "-c", "bun run scripts/db-setup.ts && bun run .output/server/index.mjs"]
