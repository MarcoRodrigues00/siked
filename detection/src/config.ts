import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// raiz do pacote (um nível acima de src/ ou dist/)
const pkgRoot = fileURLToPath(new URL('..', import.meta.url));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DETECTION_PORT: z.coerce.number().int().positive().default(8082),
  REDIS_URL: z.string().default('redis://redis:6379'),
  EVENTS_CHANNEL: z.string().default('siked:events'),
  ALERTS_CHANNEL: z.string().default('siked:alerts'),
  // dados desacoplados de código (ADR-0004)
  MAPPINGS_DIR: z.string().default(join(pkgRoot, '..', 'mappings')),
  RULES_DIR: z.string().default(join(pkgRoot, 'rules', 'signatures')),
  // janela de dedup: mesma regra+ip não redispara dentro deste intervalo
  DEDUP_WINDOW_MS: z.coerce.number().int().nonnegative().default(5000),
});

export type Config = z.infer<typeof EnvSchema>;
export const config: Config = EnvSchema.parse(process.env);
