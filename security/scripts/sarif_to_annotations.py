#!/usr/bin/env python3
"""Converte relatórios SARIF (Semgrep, Trivy) em anotações do GitHub Actions.

Os achados são agrupados (por pacote no Trivy, por regra no Semgrep) e cada grupo vira
uma anotação de erro no PR, com arquivo e linha, sem precisar abrir o log do job.
O GitHub mostra até 10 anotações de erro por etapa; um aviso final lista todos os grupos.
"""
from __future__ import annotations

import json
import re
import sys
from collections import OrderedDict

MAX_ANNOTATIONS = 10
PKG_RE = re.compile(r"Package:\s*(\S+).*?Installed Version:\s*(\S+)", re.S)
FIX_RE = re.compile(r"Fixed Version:\s*([^\n]+)")


def esc_data(value: str) -> str:
    return value.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def esc_prop(value: str) -> str:
    return esc_data(value).replace(":", "%3A").replace(",", "%2C")


def collect(paths: list[str]) -> "OrderedDict[tuple, dict]":
    groups: "OrderedDict[tuple, dict]" = OrderedDict()
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
                rule = result.get("ruleId", "?")
                message = result.get("message", {}).get("text", "")
                location = (result.get("locations") or [{}])[0].get("physicalLocation", {})
                file = location.get("artifactLocation", {}).get("uri", "")
                line = location.get("region", {}).get("startLine", 1)
                pkg = PKG_RE.search(message)
                if pkg:  # Trivy: agrupa por pacote/versão/caminho
                    key = (tool, pkg.group(1), pkg.group(2), file)
                    group = groups.setdefault(key, {
                        "tool": tool, "file": file, "line": line,
                        "title": f"{pkg.group(1)} {pkg.group(2)}", "items": [], "fix": set()})
                    group["items"].append(rule)
                    fix = FIX_RE.search(message)
                    if fix:
                        group["fix"].add(fix.group(1).strip())
                else:  # Semgrep: agrupa por regra
                    key = (tool, rule)
                    group = groups.setdefault(key, {
                        "tool": tool, "file": file, "line": line,
                        "title": rule, "items": [], "fix": set(), "message": message[:500]})
                    group["items"].append(f"{file}:{line}")
    return groups


def main(paths: list[str]) -> int:
    groups = collect(paths)
    total = sum(len(g["items"]) for g in groups.values())
    summary = []
    for index, group in enumerate(groups.values()):
        detail = ", ".join(group["items"][:12])
        if len(group["items"]) > 12:
            detail += f" (+{len(group['items']) - 12})"
        if group["fix"]:
            detail += f" | corrigido em: {'; '.join(sorted(group['fix']))}"
        text = (group.get("message", "") + " | " if group.get("message") else "") + detail
        summary.append(f"{group['title']}: {len(group['items'])}")
        if index < MAX_ANNOTATIONS:
            title = esc_prop(f"{group['tool']}: {group['title']}")
            print(f"::error file={esc_prop(group['file'])},line={group['line']},title={title}::{esc_data(text)}")
    listing = "; ".join(summary) if summary else "nenhum"
    print(f"::notice title=Resumo do scanner::{total} achado(s) em {len(groups)} grupo(s): {esc_data(listing)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
