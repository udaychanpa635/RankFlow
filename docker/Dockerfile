FROM node:20-alpine AS deps
WORKDIR /app
RUN apk update && apk upgrade --no-cache
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache wget && \
    addgroup -g 1001 -S nodejs && \
    adduser  -S leaderboard -u 1001 -G nodejs
COPY --from=deps --chown=leaderboard:nodejs /app/node_modules ./node_modules
COPY --chown=leaderboard:nodejs . .
RUN mkdir -p /app/logs && chown leaderboard:nodejs /app/logs
USER leaderboard
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "src/server.js"]
