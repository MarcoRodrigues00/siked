import { config } from './config.js';
import { logger } from './logger.js';
import { assertAllowedTarget } from './guard.js';
import { selectScenarios, type Hit } from './scenarios.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  assertAllowedTarget(config.TARGET_URL); // contenção: aborta se alvo não for local
  const chosen = selectScenarios(config.SCENARIO);

  const hit: Hit = async (req) => {
    try {
      await fetch(config.TARGET_URL + req.path, {
        method: req.method,
        signal: AbortSignal.timeout(3000),
      });
    } catch (err) {
      logger.warn('hit_failed', { path: req.path, message: (err as Error).message });
    }
    await sleep(config.DELAY_MS);
  };

  logger.info('start', { target: config.TARGET_URL, scenarios: chosen.map((s) => s.name) });
  for (const s of chosen) {
    logger.info('scenario', { name: s.name, technique: s.targetTechnique });
    await s.run(hit);
  }
  logger.info('done');
}

main().catch((err: unknown) => {
  logger.error('fatal', { message: (err as Error).message });
  process.exitCode = 1;
});
