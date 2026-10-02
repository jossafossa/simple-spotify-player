# The whole app in one container: the built site and the tab search, both
# served by server/main.ts on $PORT — 3000 unless the host sets another, as
# Coolify does. Put HTTPS in front (Coolify does this itself): Spotify
# only accepts https redirect URIs, apart from 127.0.0.1.

FROM node:22-alpine AS build
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Empty: the app calls the tab search on its own origin, this same server.
ENV VITE_TAB_SEARCH_URL=""
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
# The server has no dependencies: Node 22 runs its TypeScript directly.
COPY server/ server/
COPY --from=build /app/dist dist/
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 STATIC_DIR=/app/dist
USER node
EXPOSE 3000
# Shell form, so the check asks whatever PORT the host set — Coolify, for
# one, sets PORT to the port it routes to (80 by default).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/tabs/health" || exit 1
CMD ["node", "server/main.ts"]
