import cron from 'node-cron';
import { prisma } from '../db/index.js';

/**
 * Lock Cleanup System
 *
 * Releases stale execution locks that are preventing jobs from being processed.
 * This handles edge cases where locks are not released due to:
 * - Worker crashes
 * - Network timeouts
 * - Unexpected exceptions
 *
 * Runs every 5 minutes to check for locks older than 30 minutes.
 */

const STALE_LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Main cleanup function - finds and releases stale locks
 */
async function cleanupStaleLocks(): Promise<void> {
  const cutoffTime = new Date(Date.now() - STALE_LOCK_TIMEOUT_MS);

  try {
    const result = await prisma.deviation.updateMany({
      where: {
        executionLockId: { not: null },
        executionLockedAt: { lt: cutoffTime },
        status: { in: ['scheduled', 'draft'] },
      },
      data: {
        executionLockId: null,
        executionLockedAt: null,
        updatedAt: new Date(),
      },
    });

    if (result.count > 0) {
      console.log(`[Lock Cleanup] Released ${result.count} stale locks`);
    }
  } catch (error) {
    console.error('[Lock Cleanup] Failed to cleanup stale locks:', error);
  }
}

/**
 * Start the cron job
 * Runs every 5 minutes
 */
export function startLockCleanup(): void {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await cleanupStaleLocks();
    } catch (error) {
      console.error('[Lock Cleanup] Cron job failed:', error);
    }
  });

  console.log('[Lock Cleanup] Cron job started (runs every 5 minutes)');

  // Run once immediately on startup (helpful for catching stuck locks after server restart)
  setTimeout(() => {
    console.log('[Lock Cleanup] Running initial cleanup check...');
    cleanupStaleLocks().catch((error) => {
      console.error('[Lock Cleanup] Initial cleanup check failed:', error);
    });
  }, 15000); // 15 second delay to allow server to fully start
}

/**
 * Manually run cleanup (for testing or manual intervention)
 */
export async function runLockCleanup(): Promise<void> {
  await cleanupStaleLocks();
}
