import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  INGEST_PORT: z.coerce.number().int().positive().default(8081),
  // segredo do único canal edge->core (ADR-0003). Em produção vem do .env.
  INGEST_TOKEN: z.string().min(1).default('dev-ingest-token'),
  DATA_DIR: z.string().default('/data'),
  EVENTS_JSONL: z.string().optional(),
  INDEX_SQLITE: z.string().optional(),
  // limite de payload sanitizado guardado no evento canônico
  PAYLOAD_SNIPPET_MAX: z.coerce.number().int().positive().max(2048).default(512),
});

export type Config = z.infer<typeof EnvSchema>;
export const config: Config = EnvSchema.parse(process.env);
