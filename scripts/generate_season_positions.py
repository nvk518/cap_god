#!/usr/bin/env python3
"""Generate committed season-position seed data for CAP GOD player pools.

Positions are assigned deterministically from season box-score profiles using
documented Basketball-Reference-style role thresholds. Output is reviewed and
committed; runtime never infers positions from stats.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

ERA_ORDER = ("2000s", "2010s", "2020s")
VALID_POSITIONS = ("PG", "SG", "SF", "PF", "C")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate season_positions.json from era pools.")
    parser.add_argument("--data-dir", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def infer_positions(record: dict[str, Any]) -> list[str]:
    ast = float(record["ast"])
    trb = float(record["trb"])
    pts = float(record["pts"])
    mp = max(float(record["mp"]), 1.0)

    ast_rate = ast / mp
    trb_rate = trb / mp
    pts_rate = pts / mp

    scores = {
        "PG": ast_rate * 2.4 + pts_rate * 0.4,
        "SG": pts_rate * 1.2 + ast_rate * 0.8,
        "SF": pts_rate * 0.9 + trb_rate * 0.7 + ast_rate * 0.4,
        "PF": trb_rate * 1.5 + pts_rate * 0.5,
        "C": trb_rate * 2.0 + pts_rate * 0.2,
    }

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    primary = ranked[0][0]
    secondary = ranked[1][0]

    if primary == secondary:
        return [primary]

    primary_score = ranked[0][1]
    secondary_score = ranked[1][1]
    if secondary_score >= primary_score * 0.82:
        return [primary, secondary]

    if primary in {"PG", "SG"} and secondary in {"PG", "SG"}:
        return ["PG", "SG"]
    if primary in {"PF", "C"} and secondary in {"PF", "C"}:
        return ["PF", "C"]

    return [primary]


def generate(data_dir: Path) -> dict[str, list[str]]:
    mapping: dict[str, list[str]] = {}
    for era in ERA_ORDER:
        era_path = data_dir / f"{era}.json"
        records = json.loads(era_path.read_text(encoding="utf-8"))
        for record in records:
            player_id = record["id"]
            positions = infer_positions(record)
            for position in positions:
                if position not in VALID_POSITIONS:
                    raise ValueError(f"invalid generated position for {player_id}")
            mapping[player_id] = positions
    return mapping


def main() -> int:
    args = parse_args()
    try:
        mapping = generate(args.data_dir)
    except (KeyError, ValueError, json.JSONDecodeError, OSError) as error:
        print(f"generation failed: {error}", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(mapping, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": "ok", "players": len(mapping)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
