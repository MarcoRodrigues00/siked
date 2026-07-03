/**
 * Cenários de ataque sintético. Cada um mira uma técnica ATT&CK que a detecção
 * deve reconhecer. Os caminhos vêm percent-encoded (como um scanner real manda);
 * o ingest normaliza antes de casar as assinaturas.
 */
export interface HitReq {
  method: string;
  path: string;
}
export type Hit = (req: HitReq) => Promise<void> | void;

export interface Scenario {
  name: string;
  targetTechnique: string;
  run(hit: Hit): Promise<void>;
}

// valor do honeytoken AWS plantado no /.env da deception (fake, só para a demo)
const HONEYTOKEN_AWS = 'AKIAZ3XMPLE7SIKED42Q';

export const scan: Scenario = {
  name: 'scan',
  targetTechnique: 'T1595',
  async run(hit) {
    const paths = [
      '/wp-login.php',
      '/.env',
      '/phpmyadmin',
      '/backup.zip',
      '/admin',
      '/vendor/phpunit/eval-stdin.php',
      '/.git/config',
      '/server-status',
    ];
    for (const path of paths) await hit({ method: 'GET', path });
  },
};

export const sqli: Scenario = {
  name: 'sqli',
  targetTechnique: 'T1190',
  async run(hit) {
    await hit({ method: 'GET', path: '/search?q=1%20UNION%20SELECT%20pass%20FROM%20users' });
    await hit({ method: 'GET', path: "/item?id=1%27%20OR%20%271%27%3D%271" });
    await hit({ method: 'GET', path: '/download?file=..%2f..%2f..%2fetc%2fpasswd' });
    await hit({ method: 'GET', path: '/ping?host=127.0.0.1%3B%20cat%20/etc/passwd' });
  },
};

export const bruteforce: Scenario = {
  name: 'bruteforce',
  targetTechnique: 'T1110',
  async run(hit) {
    for (let i = 0; i < 6; i++) await hit({ method: 'POST', path: '/admin' });
  },
};

export const honeytoken: Scenario = {
  name: 'honeytoken',
  targetTechnique: 'T1078',
  async run(hit) {
    await hit({ method: 'GET', path: `/api/v1/data?key=${HONEYTOKEN_AWS}` });
  },
};

export const scenarios: Scenario[] = [scan, sqli, bruteforce, honeytoken];

export function selectScenarios(name: string): Scenario[] {
  if (name === 'all') return scenarios;
  const s = scenarios.find((x) => x.name === name);
  if (!s) throw new Error(`cenário desconhecido: ${name}`);
  return [s];
}
