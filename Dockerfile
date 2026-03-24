# ---- MCP server build ----
FROM node:22-alpine AS mcp-builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

# ---- Backend build ----
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json backend/tsconfig.json ./
RUN npm ci
COPY backend/src/ ./src/
RUN npm run build

# ---- Production image ----
FROM node:22-alpine AS production
RUN npm install -g pm2

WORKDIR /app

# MCP server — production deps + compiled output
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=mcp-builder /app/dist ./dist

# Backend — production deps + compiled output
COPY backend/package*.json ./backend/
RUN npm ci --omit=dev --prefix backend
COPY --from=backend-builder /app/backend/dist ./backend/dist

# pm2 ecosystem (CJS file — required when package.json has "type":"module")
COPY ecosystem.config.cjs ./

# Only port 3000 is public; port 3100 (MCP) stays internal
EXPOSE 3000

CMD ["pm2-runtime", "ecosystem.config.cjs"]
