# syntax=docker/dockerfile:1
# Static site served by nginx as a non-root user on port 8080 (Cloud Run).
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
COPY --chown=root:root --chmod=a=rX site/ /usr/share/nginx/html/
USER 101

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
