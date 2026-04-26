FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN bun install --frozen-lockfile --production

# Copy source
COPY packages/shared packages/shared
COPY apps/api apps/api

EXPOSE 3210
CMD ["bun", "run", "apps/api/src/main.ts"]
