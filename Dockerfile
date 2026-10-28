# syntax=docker/dockerfile:1
# taskdeck: build the static app with Node, serve dist/ with nginx.

# ---- Build -------------------------------------------------------------------
# Node 24 (LTS) matches "engines": { "node": ">=24" } in package.json.
FROM node:24-alpine AS build
WORKDIR /app

# Dependencies first, so this layer is reused while package*.json do not change;
# the npm cache mount also keeps downloads between builds (BuildKit).
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
RUN npm run build

# ---- Serve -------------------------------------------------------------------
FROM nginx:stable-alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
