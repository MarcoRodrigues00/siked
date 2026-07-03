import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolve técnica MITRE -> tática + nomes + contramedida D3FEND, a partir das
 * tabelas em `mappings/` (dados desacoplados de código — ADR-0004).
 */
export interface TechniqueInfo {
  technique: string;
  technique_name: string;
  tactic: string;
  tactic_name: string;
  d3fend: string;
}

export class AttackMap {
  private readonly byTechnique = new Map<string, TechniqueInfo>();

  constructor(mappingsDir: string) {
    const attack = JSON.parse(readFileSync(join(mappingsDir, 'mitre-attack.json'), 'utf8')) as Record<
      string,
      { name: string; tactic: string; tactic_name: string }
    >;
    const d3fend = JSON.parse(readFileSync(join(mappingsDir, 'mitre-d3fend.json'), 'utf8')) as Record<string, string>;

    for (const [technique, info] of Object.entries(attack)) {
      this.byTechnique.set(technique, {
        technique,
        technique_name: info.name,
        tactic: info.tactic,
        tactic_name: info.tactic_name,
        d3fend: d3fend[technique] ?? '',
      });
    }
  }

  resolve(technique: string): TechniqueInfo {
    return (
      this.byTechnique.get(technique) ?? {
        technique,
        technique_name: 'Unknown',
        tactic: 'TA0000',
        tactic_name: 'Unknown',
        d3fend: '',
      }
    );
  }

  techniques(): string[] {
    return [...this.byTechnique.keys()];
  }
}
