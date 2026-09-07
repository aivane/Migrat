# syntax=docker/dockerfile:1

# ---- Stage 1: build the Vite SPA ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Baked into the JS bundle at build time — see .env.example for the full list.
ARG VITE_API_MODE=direct
ARG VITE_FUNDINFO_API_MODE=direct
ARG VITE_ARTICLES_DATA_SOURCE=ajax
ARG VITE_FEATURED_ARTICLE_ID=511
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_API_MODE=$VITE_API_MODE \
    VITE_FUNDINFO_API_MODE=$VITE_FUNDINFO_API_MODE \
    VITE_ARTICLES_DATA_SOURCE=$VITE_ARTICLES_DATA_SOURCE \
    VITE_FEATURED_ARTICLE_ID=$VITE_FEATURED_ARTICLE_ID \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN npm run build

# ---- Stage 2: serve the build + reverse-proxy the real backends ----
FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Runtime-only — substituted into nginx config on container start via envsubst,
# so the proxy targets can change (e.g. a rotated ngrok URL) without rebuilding the image.
ENV PROXY_FUND_API=https://api.ideatradefund.com \
    PROXY_FUND_BACKEND=https://unexcusable-depreciatingly-lieselotte.ngrok-free.dev \
    PROXY_WP_SITE=https://ideatradefund.com

EXPOSE 80
