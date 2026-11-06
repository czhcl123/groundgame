FROM node:20-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- serve stage ---
# The app is a Next.js static export (output: 'export'), so the deploy target
# is just the generated ./out directory. Serve it with a tiny static server
# that resolves /foo -> foo.html (Next emits trailingSlash: false).

FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/out ./out
COPY --from=build /app/scripts/static-server.cjs ./scripts/static-server.cjs

ENV NODE_ENV=production

# Do NOT set ENV PORT here: Railway injects the port its proxy expects and an
# ENV in the Dockerfile would override it, so the app would listen on the wrong
# port and every request would return 502.

EXPOSE 3000

CMD ["sh", "-c", "node scripts/static-server.cjs out $PORT"]
