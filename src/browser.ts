import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium, type Browser } from 'playwright';

/** Launch Aviary's Chromium browser and retain the CLI's install and system-Chrome fallbacks. */
export async function launchAviaryBrowser(
  options: { headless?: boolean; installChromium?: () => boolean } = {}
): Promise<Browser> {
  const launchOptions = { headless: options.headless ?? true };
  try {
    return await chromium.launch(launchOptions);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const missingExecutable =
      message.includes("Executable doesn't exist") ||
      message.includes('playwright install') ||
      message.includes('Looks like Playwright was just installed or updated');
    if (!missingExecutable || process.env.AVIARY_SKIP_BROWSER_INSTALL === 'true') throw error;

    if ((options.installChromium ?? autoInstallChromium)()) {
      try {
        return await chromium.launch(launchOptions);
      } catch {
        // Fall through to the installed system Chrome channel.
      }
    }
    try {
      return await chromium.launch({ ...launchOptions, channel: 'chrome' });
    } catch {
      throw error;
    }
  }
}

export function autoInstallAviaryChromium(): boolean {
  try {
    process.stderr.write(
      '\n📦 Playwright Chromium binary not found. Downloading Chromium automatically...\n'
    );
    let playwrightCli: string | undefined;
    try {
      const packageJson = require.resolve('playwright/package.json');
      const candidate = path.join(path.dirname(packageJson), 'cli.js');
      if (fs.existsSync(candidate)) playwrightCli = candidate;
    } catch {
      // Use npx if the package's command-line entry point is unavailable.
    }

    const command = playwrightCli ? process.execPath : 'npx';
    const args = playwrightCli
      ? [playwrightCli, 'install', 'chromium']
      : ['playwright', 'install', 'chromium'];
    const result = spawnSync(command, args, {
      stdio: ['ignore', 2, 2],
      env: process.env,
    });
    if (result.status === 0) {
      process.stderr.write('✅ Chromium installed successfully.\n\n');
      return true;
    }
    process.stderr.write(`⚠️ Chromium auto-installation exited with code ${result.status}.\n`);
    return false;
  } catch (error) {
    process.stderr.write(`⚠️ Failed to auto-install Chromium: ${error}\n`);
    return false;
  }
}

function autoInstallChromium(): boolean {
  return autoInstallAviaryChromium();
}
