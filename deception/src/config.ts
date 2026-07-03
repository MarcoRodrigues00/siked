import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DECEPTION_PORT: z.coerce.number().int().positive().default(3001),
  // destino do emissor: o ingest, no único canal edge->core (ADR-0003)
  INGEST_URL: z.string().url().default('http://ingest:8081/events'),
  INGEST_TOKEN: z.string().min(1).default('dev-ingest-token'),
});

export type Config = z.infer<typeof EnvSchema>;
export const config: Config = EnvSchema.parse(process.env);
