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

# Build the CLI/library only — the TUI is a separate Rust binary built and
# shipped independently (see .github/workflows/release.yml); this image
# doesn't need a Rust toolchain.
RUN pnpm run build:ts

# ── Build Stage: Playwright Install ─────────────────────────
FROM node:20-slim AS playwright-installer
WORKDIR /app

# Install browsers to a fixed, non-home path so they're reachable regardless
# of which user the runtime stage ends up running as.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml ./
# Production dependencies only — this is exactly what ships into the runtime
# image below, so devDependencies (typescript, vitest, eslint, ...) never
# land there.
RUN pnpm install --frozen-lockfile --prod
RUN npx playwright install chromium --with-deps

# ── Runtime Stage ────────────────────────────────────────────
FROM node:20-slim AS runtime

# 12-Factor: Process runs as non-root
RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Copy Playwright browsers and production node_modules from the installer
COPY --from=playwright-installer --chown=appuser:appuser /ms-playwright /ms-playwright
COPY --from=playwright-installer --chown=appuser:appuser /app/node_modules ./node_modules

# Copy built TypeScript
COPY --from=ts-builder --chown=appuser:appuser /app/dist ./dist
COPY --from=ts-builder --chown=appuser:appuser /app/package.json ./

# Install Playwright system deps (needs root; must run before USER appuser)
RUN npx playwright install-deps chromium

# 12-Factor: Config via environment
ENV AVIARY_HEADLESS=true
ENV AVIARY_LOG_LEVEL=info
ENV NODE_ENV=production

USER appuser

# Prometheus metrics endpoint (the only port this process listens on)
EXPOSE 9090

# 12-Factor: Run as stateless process, config from env
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--help"]
