FROM oven/bun:1 AS api-deps
WORKDIR /app

COPY package.json bun.lock ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile --production

COPY packages/shared packages/shared
COPY apps/api apps/api

FROM oven/bun:1 AS web-build
WORKDIR /app

COPY package.json bun.lock ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN cd apps/web && bunx vite build

FROM oven/bun:1-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache nginx netcat-openbsd postgresql-client

COPY --from=api-deps /app /app
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
COPY apps/api/sql /app/sql
COPY docker/nginx.single.conf /etc/nginx/http.d/default.conf
COPY docker/start-single-image.sh /usr/local/bin/start-single-image.sh

RUN chmod +x /usr/local/bin/start-single-image.sh

EXPOSE 80

CMD ["/usr/local/bin/start-single-image.sh"]