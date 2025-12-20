FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config and package files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy frontend and shared package files
COPY apps/isekai-frontend/package.json ./apps/isekai-frontend/
COPY packages/shared/package.json ./packages/shared/

# Copy Prisma schema and config from shared BEFORE install (for postinstall script)
COPY packages/shared/prisma ./packages/shared/prisma
COPY packages/shared/prisma.config.ts ./packages/shared/prisma.config.ts

# Set dummy DATABASE_URL for prisma generate (doesn't actually connect)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Set NODE_ENV to development in builder stage to ensure devDependencies are installed
# (needed for TypeScript compilation and build tools like tsup, vite)
ENV NODE_ENV=development

# Install all dependencies (runs postinstall which generates Prisma client)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/isekai-frontend ./apps/isekai-frontend
COPY packages/shared ./packages/shared

# Re-run install to re-establish workspace links and regenerate Prisma client via postinstall
# This is fast because packages are already cached
RUN pnpm install --frozen-lockfile

# Accept build arguments for environment variables
ARG VITE_API_URL
ARG DEVIANTART_CLIENT_ID

# Set as environment variables for Vite build
ENV VITE_API_URL=$VITE_API_URL
ENV DEVIANTART_CLIENT_ID=$DEVIANTART_CLIENT_ID

# Build shared package first, then frontend
RUN pnpm --filter @isekai/shared build && \
    pnpm --filter isekai-frontend build

# Production stage
FROM node:20-alpine

# Install serve for serving static files
RUN npm install -g serve

WORKDIR /app

# Copy built files
COPY --from=builder /app/apps/isekai-frontend/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Serve the built app with SPA support
CMD ["serve", "-s", "dist", "-l", "3000"]
