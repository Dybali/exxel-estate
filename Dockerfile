# syntax=docker/dockerfile:1
# Site image for the Mittwald container (docs/mittwald-migration.md). Standard Next.js build
# (EXXEL_NODE_BUILD=1, output: "standalone"); the Cloudflare/vinext build is not involved.
# Secrets are never baked in: every setting comes from container environment variables at runtime.

FROM node:22.23.5-alpine3.23 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 SHARP_IGNORE_GLOBAL_LIBVIPS=1
COPY package.json package-lock.json ./
# Same flags as scripts/install-ci.mjs (npm ci from the lockfile, dev + optional dependencies).
# --ignore-scripts: the only install scripts belong to the Cloudflare toolchain (workerd/wrangler,
# glibc binaries that fail on Alpine) and esbuild's optional binary check; the Node build needs none.
RUN npm ci --workspaces=false --include=dev --include=optional --ignore-scripts --no-audit --no-fund
COPY . .
RUN EXXEL_NODE_BUILD=1 npx next build

FROM node:22.23.5-alpine3.23 AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# ffmpeg/ffprobe for listing videos (lib/video-transcode.ts, docs/listing-videos.md).
# PostgreSQL 18 client (pg_dump/pg_restore, Alpine main repo, /usr/libexec/postgresql18) for the daily
# offsite database backup (lib/db-backup-node.ts, docs/backups-monitoring.md). It must match the
# server's major version (postgres 18 container); the build fails here if the package changes.
RUN apk add --no-cache ffmpeg postgresql18-client \
  && /usr/libexec/postgresql18/pg_dump --version | grep -q " 18\." \
  && /usr/libexec/postgresql18/pg_restore --version | grep -q " 18\."
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Mittwald container cronjobs run: node scripts/cron-call.mjs health|daily (manually: backup)
COPY --from=build --chown=node:node /app/scripts/cron-call.mjs ./scripts/cron-call.mjs
# Applied at startup from 018 on (instrumentation.ts -> lib/postgres-migrations.ts); read from
# process.cwd()/postgres/migrations, i.e. /app/postgres/migrations.
COPY --from=build --chown=node:node /app/postgres/migrations ./postgres/migrations
# Commit of this image, recorded in the backup manifest (mittwald.yml passes it; empty elsewhere).
ARG APP_COMMIT=""
ENV APP_COMMIT=$APP_COMMIT
# The official image's unprivileged user (uid 1000).
USER node
EXPOSE 3000
# Liveness only (no database or storage): /api/health/live.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.js"]
