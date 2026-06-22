# =============================================================================
# CodePop Server Dockerfile - Multi-stage production build
# =============================================================================

# -----------------------------------------------------------------------------
# Build stage - compile TypeScript and install dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Copy package files first for better layer caching
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# -----------------------------------------------------------------------------
# Production stage - minimal runtime image
# -----------------------------------------------------------------------------
FROM node:20-alpine

WORKDIR /app

# Install git for potential git operations
RUN apk add --no-cache git

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Set production environment
ENV NODE_ENV=production

# Expose application ports
# 3000: Main API server
# 3001: MCP (Model Context Protocol) server
EXPOSE 3000 3001

# Health check to verify the server is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the server
CMD ["node", "dist/index.js"]
