import type { Request, Response } from 'express';
import { tokenValue } from './honeytokens.js';

/**
 * Honeypots low-interaction (PLANO §2 camada 2). Endpoints que PARECEM reais mas
 * não têm sistema por trás — só respondem de forma verossímil para *elicit*
 * (provocar) mais interação (MITRE Engage: expose -> elicit -> collect).
 * Nenhum executa nada real.
 */
export interface Bait {
  id: string;
  handler: (req: Request, res: Response) => void;
}

const html = (body: string) => body;

// /.env falso — expõe honeytokens (a "recompensa" que o scanner procura)
const fakeEnv = [
  'APP_ENV=production',
  'APP_DEBUG=false',
  `AWS_ACCESS_KEY_ID=${tokenValue('ht_aws_key')}`,
  'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  `STRIPE_API_KEY=${tokenValue('ht_api_key')}`,
  'DB_HOST=10.0.12.4',
  '',
].join('\n');

// /admin falso — senha falsa escondida em comentário HTML (elicit)
const adminLogin = html(`<!DOCTYPE html>
<html><head><title>Admin • Login</title></head>
<body>
  <h1>Painel Administrativo</h1>
  <form method="post" action="/admin">
    <input name="user" placeholder="usuário"/>
    <input name="pass" type="password" placeholder="senha"/>
    <button>Entrar</button>
  </form>
  <!-- TODO remover antes de produção: admin / ${tokenValue('ht_admin_cred')} -->
</body></html>`);

const wpLogin = html(`<!DOCTYPE html>
<html><head><title>WordPress › Log In</title></head>
<body class="login">
  <form name="loginform" action="/wp-login.php" method="post">
    <input type="text" name="log" placeholder="Username"/>
    <input type="password" name="pwd" placeholder="Password"/>
    <input type="submit" value="Log In"/>
  </form>
</body></html>`);

const phpMyAdmin = html(`<!DOCTYPE html>
<html><head><title>phpMyAdmin</title></head>
<body>
  <h1>Welcome to phpMyAdmin</h1>
  <form method="post" action="index.php">
    <input name="pma_username" placeholder="Username"/>
    <input name="pma_password" type="password" placeholder="Password"/>
    <button>Go</button>
  </form>
</body></html>`);

const notFound = html('<html><head><title>404 Not Found</title></head><body><center><h1>404 Not Found</h1></center><hr><center>nginx/1.24.0</center></body></html>');

export const BAITS: Record<string, Bait> = {
  '/admin': { id: 'hp_admin', handler: (_q, res) => res.status(200).type('html').send(adminLogin) },
  '/wp-login.php': { id: 'hp_wp_login', handler: (_q, res) => res.status(200).type('html').send(wpLogin) },
  '/.env': { id: 'hp_env', handler: (_q, res) => res.status(200).type('text/plain').send(fakeEnv) },
  '/api/v1/keys': { id: 'hp_api_keys', handler: (_q, res) => res.status(401).json({ error: 'unauthorized' }) },
  '/backup.zip': {
    id: 'hp_backup',
    handler: (_q, res) => res.status(200).type('application/zip').send(Buffer.from('PK\x03\x04siked-fake-archive')),
  },
  '/phpmyadmin': { id: 'hp_phpmyadmin', handler: (_q, res) => res.status(200).type('html').send(phpMyAdmin) },
};

// qualquer outro caminho: tráfego de scanning genérico (ninguém legítimo chega aqui)
export const SCAN_BAIT: Bait = {
  id: 'hp_scan',
  handler: (_q, res) => res.status(404).type('html').send(notFound),
};

export function resolveBait(path: string): Bait {
  return BAITS[path] ?? SCAN_BAIT;
}
