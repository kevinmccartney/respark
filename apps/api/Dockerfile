# syntax=docker/dockerfile:1
# Build from repository root: docker build -f apps/api/Dockerfile .

FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --workspace=api
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json apps/api/
COPY apps/api/src apps/api/src
RUN npm run build -w api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY apps/api/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /repo/apps/api/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
