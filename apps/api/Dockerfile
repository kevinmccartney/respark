# syntax=docker/dockerfile:1
# Build from repository root: docker build -f apps/api/Dockerfile .

FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/etl/package.json apps/etl/
COPY packages/schemas/package.json packages/schemas/
COPY packages/scryfall-query/package.json packages/scryfall-query/
ENV HUSKY=0
RUN npm ci --workspace=api --workspace=etl --workspace=@respark/schemas --workspace=@respark/scryfall-query
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json apps/api/
COPY apps/api/src apps/api/src
COPY apps/etl/tsconfig.json apps/etl/
COPY apps/etl/src apps/etl/src
COPY packages/schemas/tsconfig.json packages/schemas/
COPY packages/schemas/src packages/schemas/src
COPY packages/scryfall-query/tsconfig.json packages/scryfall-query/
COPY packages/scryfall-query/src packages/scryfall-query/src
# Workspace packages export point at dist/; build them before api so Nest can resolve them.
RUN npm run build -w @respark/schemas && npm run build -w @respark/scryfall-query && npm run build -w etl && npm run build -w api

FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
ENV ETL_REPO_ROOT=/repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/etl/package.json apps/etl/
COPY packages/schemas/package.json packages/schemas/
COPY packages/scryfall-query/package.json packages/scryfall-query/
ENV HUSKY=0
RUN npm ci --omit=dev --workspace=api --workspace=etl --workspace=@respark/schemas --workspace=@respark/scryfall-query --no-audit --no-fund

# RDS enforces TLS and signs certificates with its own root CA, which is not in
# Node's default trust store. Bundling it keeps verification on.
RUN apk add --no-cache ca-certificates curl \
  && curl -fsSL -o /repo/rds-global-bundle.pem \
     https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
  && apk del curl
ENV DATABASE_CA_PATH=/repo/rds-global-bundle.pem

COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/etl/dist ./apps/etl/dist
COPY --from=build /repo/packages/schemas/dist ./packages/schemas/dist
COPY --from=build /repo/packages/scryfall-query/dist ./packages/scryfall-query/dist
# Applied at startup when RUN_MIGRATIONS=true; drizzle-orm ships the migrator, so
# drizzle-kit is not needed in the runtime image.
COPY apps/api/drizzle ./apps/api/drizzle
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
