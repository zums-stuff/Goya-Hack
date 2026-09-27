# PumaTrade — Next.js 16 standalone (prod)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev=false

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* se hornean en build time
ARG NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_PLATFORM_FEE_BPS=200
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5433/pumatrade
ENV NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY=$NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY \
    NEXT_PUBLIC_PLATFORM_FEE_BPS=$NEXT_PUBLIC_PLATFORM_FEE_BPS \
    DATABASE_URL=$DATABASE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p /app/public && npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
