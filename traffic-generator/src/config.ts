import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // alvo: a deception local isolada (nunca um host externo — ver guard.ts)
  TARGET_URL: z.string().url().default('http://deception:3001'),
  SCENARIO: z.string().default('all'), // all | scan | sqli | bruteforce | honeytoken
  DELAY_MS: z.coerce.number().int().nonnegative().default(150),
});

export type Config = z.infer<typeof EnvSchema>;
export const config: Config = EnvSchema.parse(process.env);
