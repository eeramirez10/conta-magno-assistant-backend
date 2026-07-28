FROM node:22-bookworm-slim AS builder

  WORKDIR /app

  RUN apt-get update \
      && apt-get install -y --no-install-recommends openssl \
      && rm -rf /var/lib/apt/lists/* \
      && npm install --global pnpm@9

  COPY package.json pnpm-lock.yaml ./
  COPY prisma ./prisma
  RUN pnpm install --frozen-lockfile

  COPY . .
  RUN pnpm prisma:generate && pnpm build


  FROM node:22-bookworm-slim

  WORKDIR /app

  ENV NODE_ENV=production
  ENV PORT=4000

  RUN apt-get update \
      && apt-get install -y --no-install-recommends openssl \
      && rm -rf /var/lib/apt/lists/*

  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/node_modules ./node_modules

  EXPOSE 4000

  CMD ["node", "dist/presentation/http/server.js"]