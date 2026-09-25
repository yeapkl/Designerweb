# syntax=docker/dockerfile:1

# ---- Build stage: render one page per language into dist/ ----
FROM node:22-alpine AS build
WORKDIR /app
# Optional: the public site URL (e.g. https://www.imili.my) for absolute
# canonical/hreflang links and sitemap.xml. Safe to leave empty.
ARG SITE_URL=""
COPY scripts ./scripts
COPY src ./src
COPY site ./site
RUN SITE_URL="$SITE_URL" node scripts/build.mjs

# ---- Runtime stage: static files served by nginx, non-root, port 8080 ----
FROM nginxinc/nginx-unprivileged:1.30-alpine

# Drop the image's default server block and templates; only ours is served.
USER root
# Pull in Alpine security fixes released after the base image was built
# (e.g. CVE-2026-93990 in libexpat was flagged by Trivy on 1.30-alpine).
RUN apk upgrade --no-cache \
    && rm -f /etc/nginx/conf.d/*.conf && rm -rf /etc/nginx/templates /usr/share/nginx/html/* \
    && mkdir -p /etc/nginx/snippets
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build --chown=root:root --chmod=a=rX /app/dist/ /usr/share/nginx/html/
USER 101

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
