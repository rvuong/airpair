#!/usr/bin/env python3
"""
Extrait les tokens Claude Code par semaine ISO pour le projet airpair.
Usage : python3 sci/extract-weekly-usage.py [--save]

Produit un fichier par semaine : sci/ai-usage/2026-Wss.json
"""

import json
import sys
import glob
from pathlib import Path
from datetime import datetime
from collections import defaultdict

PROJECT_DIR = (
    Path.home() / ".claude/projects/-home-remyvuong-projects-personal-airpair"
)


def iso_week(dt):
    """Retourne la semaine ISO au format YYYY-Wss"""
    iso = dt.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def extract_by_week():
    files = sorted(PROJECT_DIR.glob("*.jsonl"))
    if not files:
        print(f"Aucun fichier trouvé dans {PROJECT_DIR}", file=sys.stderr)
        sys.exit(1)

    weeks = defaultdict(lambda: {
        "input": 0,
        "output": 0,
        "cache_creation": 0,
        "cache_read": 0,
    })

    seen = set()
    file_count_by_week = defaultdict(set)

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

                ts_str = rec.get("timestamp")
                if not ts_str:
                    continue

                try:
                    ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    continue

                week = iso_week(ts)
                seen.add(req_id)
                file_count_by_week[week].add(f.name)

                weeks[week]["input"] += usage.get("input_tokens", 0)
                weeks[week]["output"] += usage.get("output_tokens", 0)
                weeks[week]["cache_creation"] += usage.get("cache_creation_input_tokens", 0)
                weeks[week]["cache_read"] += usage.get("cache_read_input_tokens", 0)

    return weeks, file_count_by_week, len(seen)


def main():
    weeks, file_count_by_week, total_requests = extract_by_week()

    # Afficher les résultats par semaine
    for week in sorted(weeks.keys()):
        t = weeks[week]
        files = file_count_by_week[week]
        total = t["input"] + t["output"] + t["cache_creation"] + t["cache_read"]
        print(f"{week} : {len(files)} fichiers, {total:,} tokens bruts")
        print(f"         Input={t['input']:,}, Output={t['output']:,}, Cache write={t['cache_creation']:,}, Cache read={t['cache_read']:,}")

    # Optionnel : sauvegarder les fichiers
    if "--save" in sys.argv:
        out_dir = Path(__file__).parent / "ai-usage"
        out_dir.mkdir(exist_ok=True)
        for week in sorted(weeks.keys()):
            t = weeks[week]
            result = {
                "week": week,
                "project": "airpair",
                "source": str(PROJECT_DIR),
                "files_in_week": len(file_count_by_week[week]),
                "tokens": t,
            }
            out_file = out_dir / f"{week}.json"
            out_file.write_text(json.dumps(result, indent=2))
            print(f"Sauvegardé : {out_file}", file=sys.stderr)


if __name__ == "__main__":
    main()
