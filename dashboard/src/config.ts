import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const pkgRoot = fileURLToPath(new URL('..', import.meta.url));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DASHBOARD_PORT: z.coerce.number().int().positive().default(8080),
  REDIS_URL: z.string().default('redis://redis:6379'),
  ALERTS_CHANNEL: z.string().default('siked:alerts'),
  UI_DIR: z.string().default(join(pkgRoot, 'ui', 'dist')),
});

export type Config = z.infer<typeof EnvSchema>;
export const config: Config = EnvSchema.parse(process.env);
