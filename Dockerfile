# Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production server runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_DIR=/app/data

RUN apk add --no-cache sqlite

COPY package*.json ./
RUN npm ci --omit=dev

COPY server/ ./server/
COPY --from=frontend-builder /app/dist ./dist

# Persistent storage mount point (mount a Coolify volume here)
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["node", "server/index.js"]
