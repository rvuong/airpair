#!/usr/bin/env python3
"""
Extrait les tokens Claude Code pour le projet airpair depuis les logs locaux.
Usage : python3 sci/extract-ai-usage.py [--json] [--save]

Déduplication par requestId (évite de compter plusieurs fois les messages
dupliqués dans le JSONL — Claude Code écrit la même réponse sous plusieurs
entrées pour les tools chains).

Catégories de tokens :
  input          : tokens d'entrée réels (non cachés)
  output         : tokens générés
  cache_creation : tokens écrits en cache (comptés en facturation, coût énergie ≈ input)
  cache_read     : tokens lus depuis le cache (facturation ~10× moins chère,
                   coût énergie probablement réduit — pas de facteur publié)
"""

import json
import sys
import glob
import argparse
from pathlib import Path
from datetime import datetime

PROJECT_DIR = (
    Path.home() / ".claude/projects/-home-remyvuong-projects-personal-airpair"
)


def extract():
    files = sorted(PROJECT_DIR.glob("*.jsonl"))
    if not files:
        print(f"Aucun fichier trouvé dans {PROJECT_DIR}", file=sys.stderr)
        sys.exit(1)

    totals = {"input": 0, "output": 0, "cache_creation": 0, "cache_read": 0}
    seen = set()

    for f in files:
        with open(f) as fh:
            for line in fh:
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue
                req_id = rec.get("requestId")
                if not req_id or req_id in seen:
                    continue
                usage = rec.get("message", {}).get("usage", {})
                if not usage:
                    continue
                seen.add(req_id)
                totals["input"]          += usage.get("input_tokens", 0)
                totals["output"]         += usage.get("output_tokens", 0)
                totals["cache_creation"] += usage.get("cache_creation_input_tokens", 0)
                totals["cache_read"]     += usage.get("cache_read_input_tokens", 0)

    return totals, len(files), len(seen)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Sortie JSON")
    parser.add_argument(
        "--save",
        action="store_true",
        help="Enregistrer dans sci/ai-usage/YYYY-MM-DD.json",
    )
    args = parser.parse_args()

    totals, n_files, n_requests = extract()
    today = datetime.now().strftime("%Y-%m-%d")

    result = {
        "date": today,
        "project": "airpair",
        "source": str(PROJECT_DIR),
        "files": n_files,
        "requests": n_requests,
        "tokens": totals,
    }

    if args.json or args.save:
        output = json.dumps(result, indent=2)
        if args.save:
            out_dir = Path(__file__).parent / "ai-usage"
            out_dir.mkdir(exist_ok=True)
            out_file = out_dir / f"{today}.json"
            out_file.write_text(output)
            print(f"Sauvegardé : {out_file}", file=sys.stderr)
        if args.json:
            print(output)
    else:
        t = totals
        print(f"Claude Code — airpair ({today})")
        print(f"  Sessions : {n_files} fichiers, {n_requests} requêtes")
        print(f"  Input         : {t['input']:>12,}")
        print(f"  Output        : {t['output']:>12,}")
        print(f"  Cache création: {t['cache_creation']:>12,}")
        print(f"  Cache read    : {t['cache_read']:>12,}")
        total_billed = t["input"] + t["output"] + t["cache_creation"] + t["cache_read"]
        print(f"  ─────────────────────────────")
        print(f"  Total (brut)  : {total_billed:>12,}")


if __name__ == "__main__":
    main()
