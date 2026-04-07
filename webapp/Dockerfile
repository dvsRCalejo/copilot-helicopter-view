# Stage 1 — build
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json ./
RUN npm install --frozen-lockfile

COPY . .

# Build args are baked into the static bundle at build time.
# Pass them with: docker build --build-arg VITE_CLIENT_ID=... etc.
ARG VITE_CLIENT_ID
ARG VITE_TENANT_ID
ARG VITE_DATAVERSE_URL

ENV VITE_CLIENT_ID=$VITE_CLIENT_ID \
    VITE_TENANT_ID=$VITE_TENANT_ID \
    VITE_DATAVERSE_URL=$VITE_DATAVERSE_URL

RUN npm run build

# Stage 2 — serve
FROM nginx:1.27-alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
