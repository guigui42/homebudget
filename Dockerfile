# --- Stage 1: Install all dependencies (shared by build stages) ---
FROM oven/bun:1.3.13 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile

# --- Stage 2: Build web SPA ---
FROM deps AS web-build
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN cd apps/web && bunx vite build

# --- Stage 3: Bundle API into a single file ---
FROM deps AS api-build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN cd apps/api && bun build src/main.ts --outfile dist/main.js --target bun

# --- Stage 4: Minimal runtime ---
FROM oven/bun:1.3.13-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache nginx postgresql-client

COPY --from=api-build /app/apps/api/dist/main.js /app/dist/main.js
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
COPY apps/api/sql /app/sql
COPY docker/nginx.single.conf /etc/nginx/http.d/default.conf
COPY docker/start-single-image.sh /usr/local/bin/start-single-image.sh

RUN chmod +x /usr/local/bin/start-single-image.sh

EXPOSE 80

CMD ["/usr/local/bin/start-single-image.sh"]