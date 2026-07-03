import { z } from 'zod';

/**
 * Configuração validada na subida. Env inválido = falha imediata (fail-fast),
 * em vez de comportamento indefinido em runtime.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_PORT: z.coerce.number().int().positive().default(3000),
  // body cap — protege contra payloads gigantes (DoS de memória)
  BODY_LIMIT: z.string().default('64kb'),
  // rate limit
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  JWT_ISSUER: z.string().default('siked'),
});

export type Config = z.infer<typeof EnvSchema>;

export const config: Config = EnvSchema.parse(process.env);
