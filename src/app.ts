import fs from 'node:fs';
import path from 'node:path';
import { bot, startBot } from './bot/bot.js';
import { startWebsiteApi } from './server/websiteApi.js';

const lockFilePath = path.resolve(process.cwd(), 'data', 'bot.lock');

function pidIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireBotLock(): boolean {
  fs.mkdirSync(path.dirname(lockFilePath), { recursive: true });

  try {
    const lockFd = fs.openSync(lockFilePath, 'wx');
    fs.writeFileSync(lockFd, String(process.pid), 'utf8');
    fs.closeSync(lockFd);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }

    const existingPidText = fs.readFileSync(lockFilePath, 'utf8').trim();
    const existingPid = Number(existingPidText);

    if (Number.isFinite(existingPid) && pidIsAlive(existingPid)) {
      console.log(`[startup] BotTele instance already running under PID ${existingPid}. Keeping the existing bot usable and exiting this duplicate process cleanly.`);
      return false;
    }

    fs.unlinkSync(lockFilePath);
    const retryFd = fs.openSync(lockFilePath, 'wx');
    fs.writeFileSync(retryFd, String(process.pid), 'utf8');
    fs.closeSync(retryFd);
    return true;
  }
}

function releaseBotLock(): void {
  try {
    fs.unlinkSync(lockFilePath);
  } catch {
    // Lock file may already be gone or may be stale.
  }
}

if (!acquireBotLock()) {
  process.exit(0);
}

const websiteApiServer = startWebsiteApi();

console.log('Bot Telegram manual sedang berjalan...');
console.log('Mode: customer -> CS -> admin via ticket flow');

void startBot().catch((error: unknown) => {
  const description = error instanceof Error ? error.message : String(error);

  if (description.includes('409') || description.includes('terminated by other getUpdates request')) {
    console.warn('[startup] Another bot instance is already polling Telegram updates. The running instance remains usable, and this duplicate process exits safely.');
    console.warn('[startup] Conflict error detail:', error);
    releaseBotLock();
    setTimeout(() => process.exit(0), 500);
  } else {
    console.error('[startup] Failed to start bot.', error);
    releaseBotLock();
    setTimeout(() => process.exit(1), 500);
  }
});

const shutdown = (): void => {
  void bot.stop();
  releaseBotLock();
  websiteApiServer.close(() => process.exit(0));
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
