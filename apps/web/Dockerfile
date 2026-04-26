FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/web apps/web

# In production, API is on the same origin (reverse proxy)
RUN cd apps/web && bunx vite build

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
