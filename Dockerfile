# ── Build Stage: TypeScript ──────────────────────────────────
FROM node:20-slim AS ts-builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY src/ ./src/
COPY tsconfig.json ./
COPY scripts/ ./scripts/

# Build
RUN pnpm run build

# ── Build Stage: Playwright Install ─────────────────────────
FROM node:20-slim AS playwright-installer
WORKDIR /app
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
RUN npx playwright install chromium --with-deps

# ── Runtime Stage ────────────────────────────────────────────
FROM node:20-slim AS runtime

# 12-Factor: Process runs as non-root
RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Copy Playwright browsers from builder
COPY --from=playwright-installer /root/.cache/ms-playwright /root/.cache/ms-playwright
COPY --from=playwright-installer /app/node_modules ./node_modules

# Copy built TypeScript
COPY --from=ts-builder /app/dist ./dist
COPY --from=ts-builder /app/package.json ./

# Install Playwright system deps
RUN npx playwright install-deps chromium

# 12-Factor: Config via environment
ENV E2E_SEO_HEADLESS=true
ENV E2E_SEO_LOG_LEVEL=info
ENV NODE_ENV=production

USER appuser

# 12-Factor: Expose port for potential HTTP mode
EXPOSE 3000

# 12-Factor: Run as stateless process, config from env
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--help"]
