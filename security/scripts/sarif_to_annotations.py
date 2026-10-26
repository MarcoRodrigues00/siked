#!/usr/bin/env python3
"""Converte relatórios SARIF (Semgrep, Trivy) em anotações do GitHub Actions.

Cada achado vira uma anotação de erro no PR, apontando arquivo e linha, sem precisar
abrir o log do job. O GitHub mostra até 10 anotações de erro por etapa; o resumo final
informa o total.
"""
from __future__ import annotations

import json
import sys

MAX_ANNOTATIONS = 10


def esc_data(value: str) -> str:
    return value.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def esc_prop(value: str) -> str:
    return esc_data(value).replace(":", "%3A").replace(",", "%2C")


def main(paths: list[str]) -> int:
    total = 0
    for path in paths:
        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
        except FileNotFoundError:
            print(f"::warning::Relatório SARIF não encontrado: {esc_data(path)}")
            continue
        for run in data.get("runs", []):
            tool = run.get("tool", {}).get("driver", {}).get("name", "scanner")
            for result in run.get("results", []):
                total += 1
                if total > MAX_ANNOTATIONS:
                    continue
                rule = result.get("ruleId", "?")
                message = result.get("message", {}).get("text", "")[:900]
                location = (result.get("locations") or [{}])[0].get("physicalLocation", {})
                file = location.get("artifactLocation", {}).get("uri", "")
                line = location.get("region", {}).get("startLine", 1)
                title = esc_prop(f"{tool}: {rule}")
                print(f"::error file={esc_prop(file)},line={line},title={title}::{esc_data(message)}")
    print(f"::notice title=Resumo do scanner::{total} achado(s) em {esc_data(', '.join(paths))}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
