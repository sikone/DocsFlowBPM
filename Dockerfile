# ─── Stage 1: install dependencies ───────────────────────────────────────────
FROM oven/bun:1-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Generate Prisma client with linux-musl binary (see schema.prisma binaryTargets)
RUN bunx prisma generate
# next build + cp static/public into .next/standalone/ (see package.json build script)
RUN bun run build
# Ensure Prisma native binary is inside the standalone node_modules tree
RUN cp -r node_modules/.prisma .next/standalone/node_modules/.prisma

# ─── Stage 3: production runner ───────────────────────────────────────────────
FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Listen on all interfaces inside the container
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone output already contains server.js, node_modules, .next, public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Persistent upload directory (mount a volume here)
RUN mkdir -p storage/uploads && chown -R nextjs:nodejs storage

USER nextjs
EXPOSE 3000

# Logs go straight to stdout — no tee, no file redirect
CMD ["node", "server.js"]
