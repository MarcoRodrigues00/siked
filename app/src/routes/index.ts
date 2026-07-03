import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middlewares/validate.js';

export const router = Router();

/** Health check — usado pela DoD do Sprint 0 e pelo healthcheck do container. */
router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

/** Rota raiz legítima. */
router.get('/', (_req, res) => {
  res.status(200).json({ name: 'siked', message: 'app real seguro' });
});

/**
 * Endpoint legítimo de exemplo com validação de entrada (Zod).
 * Serve para provar o contraste com as iscas: entrada inválida -> 400 limpo,
 * nada de comportamento surpreendente.
 */
const EchoSchema = z.object({
  message: z.string().min(1).max(280),
});

router.post('/echo', validateBody(EchoSchema), (req, res) => {
  res.status(200).json({ echo: req.body.message });
});
