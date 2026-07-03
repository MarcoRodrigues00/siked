import type { RequestHandler } from 'express';

/**
 * 404 padrão para rotas legítimas inexistentes.
 * Atenção: caminhos como /admin, /wp-login.php, /.env NÃO caem aqui na versão
 * final — serão servidos pela camada de decepção (Sprint 1) como iscas.
 */
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'not_found' });
};
