#!/usr/bin/env python3
"""Generate top-5 rated champion roster names for sim commentary."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "public" / "data" / "players"
OUTPUT = ROOT / "src" / "data" / "championRosters.ts"

# Notable rotation players on each championship roster (by canonical player name).
CHAMPION_ROSTER_NAMES: dict[str, list[str]] = {
    "2000-lakers": [
        "Shaquille O'Neal",
        "Kobe Bryant",
        "Glen Rice",
        "Rick Fox",
        "Derek Fisher",
        "Robert Horry",
        "A.C. Green",
        "Lindsey Hunter",
        "Tyronn Lue",
        "Devean George",
    ],
    "2001-lakers": [
        "Shaquille O'Neal",
        "Kobe Bryant",
        "Rick Fox",
        "Derek Fisher",
        "Robert Horry",
        "Horace Grant",
        "Devean George",
        "Lindsey Hunter",
        "Mark Madsen",
        "Tyronn Lue",
    ],
    "2002-lakers": [
        "Shaquille O'Neal",
        "Kobe Bryant",
        "Rick Fox",
        "Derek Fisher",
        "Robert Horry",
        "Samaki Walker",
        "Devean George",
        "Lindsey Hunter",
        "Mark Madsen",
    ],
    "2003-spurs": [
        "Tim Duncan",
        "Tony Parker",
        "Manu Ginobili",
        "David Robinson",
        "Bruce Bowen",
        "Stephen Jackson",
        "Malik Rose",
        "Steve Kerr",
        "Danny Ferry",
    ],
    "2004-pistons": [
        "Chauncey Billups",
        "Richard Hamilton",
        "Ben Wallace",
        "Rasheed Wallace",
        "Tayshaun Prince",
        "Corliss Williamson",
        "Lindsey Hunter",
        "Mehmet Okur",
    ],
    "2005-spurs": [
        "Tim Duncan",
        "Tony Parker",
        "Manu Ginobili",
        "Bruce Bowen",
        "Brent Barry",
        "Nazr Mohammed",
        "Robert Horry",
        "Malik Rose",
    ],
    "2006-heat": [
        "Dwyane Wade",
        "Shaquille O'Neal",
        "Antoine Walker",
        "Udonis Haslem",
        "Jason Williams",
        "Gary Payton",
        "James Posey",
        "Alonzo Mourning",
    ],
    "2007-spurs": [
        "Tim Duncan",
        "Tony Parker",
        "Manu Ginobili",
        "Bruce Bowen",
        "Michael Finley",
        "Brent Barry",
        "Robert Horry",
        "Jacque Vaughn",
    ],
    "2008-celtics": [
        "Kevin Garnett",
        "Paul Pierce",
        "Ray Allen",
        "Rajon Rondo",
        "Kendrick Perkins",
        "James Posey",
        "Eddie House",
        "Leon Powe",
        "P.J. Brown",
        "Sam Cassell",
    ],
    "2009-lakers": [
        "Kobe Bryant",
        "Pau Gasol",
        "Lamar Odom",
        "Andrew Bynum",
        "Derek Fisher",
        "Trevor Ariza",
        "Luke Walton",
        "Sasha Vujacic",
        "Jordan Farmar",
    ],
    "2010-lakers": [
        "Kobe Bryant",
        "Pau Gasol",
        "Lamar Odom",
        "Andrew Bynum",
        "Derek Fisher",
        "Metta World Peace",
        "Shannon Brown",
        "Matt Barnes",
        "Sasha Vujacic",
    ],
    "2011-mavericks": [
        "Dirk Nowitzki",
        "Jason Terry",
        "Jason Kidd",
        "Shawn Marion",
        "Tyson Chandler",
        "Peja Stojakovic",
        "J.J. Barea",
        "DeShawn Stevenson",
        "Brendan Haywood",
    ],
    "2012-heat": [
        "LeBron James",
        "Dwyane Wade",
        "Chris Bosh",
        "Mario Chalmers",
        "Shane Battier",
        "Mike Miller",
        "Udonis Haslem",
        "Norris Cole",
        "James Jones",
    ],
    "2013-heat": [
        "LeBron James",
        "Dwyane Wade",
        "Chris Bosh",
        "Ray Allen",
        "Mario Chalmers",
        "Shane Battier",
        "Chris Andersen",
        "Norris Cole",
        "Mike Miller",
        "Rashard Lewis",
    ],
    "2014-spurs": [
        "Tim Duncan",
        "Tony Parker",
        "Kawhi Leonard",
        "Manu Ginobili",
        "Boris Diaw",
        "Tiago Splitter",
        "Danny Green",
        "Marco Belinelli",
        "Patty Mills",
    ],
    "2015-warriors": [
        "Stephen Curry",
        "Klay Thompson",
        "Draymond Green",
        "Andrew Bogut",
        "Andre Iguodala",
        "Harrison Barnes",
        "Shaun Livingston",
        "Marreese Speights",
        "Festus Ezeli",
    ],
    "2016-cavs": [
        "LeBron James",
        "Kyrie Irving",
        "Kevin Love",
        "Tristan Thompson",
        "J.R. Smith",
        "Iman Shumpert",
        "Iman Shumpert",
        "Channing Frye",
        "Richard Jefferson",
        "Matthew Dellavedova",
    ],
    "2017-warriors": [
        "Stephen Curry",
        "Kevin Durant",
        "Klay Thompson",
        "Draymond Green",
        "Andre Iguodala",
        "Zaza Pachulia",
        "Shaun Livingston",
        "David West",
        "JaVale McGee",
    ],
    "2018-warriors": [
        "Stephen Curry",
        "Kevin Durant",
        "Klay Thompson",
        "Draymond Green",
        "Andre Iguodala",
        "Kevon Looney",
        "Shaun Livingston",
        "Nick Young",
        "David West",
        "JaVale McGee",
    ],
    "2019-raptors": [
        "Kawhi Leonard",
        "Kyle Lowry",
        "Pascal Siakam",
        "Marc Gasol",
        "Fred VanVleet",
        "Danny Green",
        "Serge Ibaka",
        "Norman Powell",
        "Patrick McCaw",
    ],
    "2020-lakers": [
        "LeBron James",
        "Anthony Davis",
        "Danny Green",
        "Kentavious Caldwell-Pope",
        "Alex Caruso",
        "Dwight Howard",
        "JaVale McGee",
        "Rajon Rondo",
        "Markieff Morris",
        "Kyle Kuzma",
    ],
    "2021-bucks": [
        "Giannis Antetokounmpo",
        "Khris Middleton",
        "Jrue Holiday",
        "Brook Lopez",
        "Donte DiVincenzo",
        "Bobby Portis",
        "P.J. Tucker",
        "Bryn Forbes",
        "Pat Connaughton",
    ],
    "2022-warriors": [
        "Stephen Curry",
        "Klay Thompson",
        "Draymond Green",
        "Andrew Wiggins",
        "Jordan Poole",
        "Kevon Looney",
        "Gary Payton II",
        "Otto Porter Jr.",
        "Nemanja Bjelica",
    ],
    "2023-nuggets": [
        "Nikola Jokic",
        "Jamal Murray",
        "Michael Porter Jr.",
        "Aaron Gordon",
        "Kentavious Caldwell-Pope",
        "Bruce Brown",
        "Christian Braun",
        "Jeff Green",
        "Reggie Jackson",
    ],
    "2024-celtics": [
        "Jayson Tatum",
        "Jaylen Brown",
        "Kristaps Porzingis",
        "Jrue Holiday",
        "Derrick White",
        "Al Horford",
        "Sam Hauser",
        "Payton Pritchard",
        "Xavier Tillman",
    ],
    "2025-thunder": [
        "Shai Gilgeous-Alexander",
        "Chet Holmgren",
        "Jalen Williams",
        "Luguentz Dort",
        "Cason Wallace",
        "Isaiah Joe",
        "Aaron Wiggins",
        "Kenrich Williams",
        "Jaylin Williams",
        "Alex Caruso",
    ],
}


def load_all_players() -> list[dict]:
    players: list[dict] = []
    for path in sorted(DATA_DIR.glob("*.json")):
        if path.name == "manifest.json":
            continue
        players.extend(json.loads(path.read_text()))
    return players


def lookup_player(
    players_by_name_year: dict[tuple[str, int], dict],
    name: str,
    year_end: int,
) -> dict | None:
    direct = players_by_name_year.get((name, year_end))
    if direct:
        return direct

    for offset in (1, -1, 2, -2):
        nearby = players_by_name_year.get((name, year_end + offset))
        if nearby:
            return nearby

    return None


def parse_champions() -> list[tuple[str, int]]:
    text = (ROOT / "src" / "data" / "champions.ts").read_text()
    return [
        (match.group(1), int(match.group(2)))
        for match in re.finditer(
            r"\{ id: '([^']+)', name: [^,]+, rating: \d+, era: '[^']+', seasonYear: (\d+) \}",
            text,
        )
    ]


def main() -> None:
    players = load_all_players()
    players_by_name_year = {(player["player"], player["yearEnd"]): player for player in players}

    lines = [
        "/** Top-5 rated players per championship team — generated by scripts/generate_champion_rosters.py */",
        "",
        "export const CHAMPION_ROSTERS: Record<string, readonly string[]> = {",
    ]

    warnings: list[str] = []

    for champion_id, season_year in parse_champions():
        roster_names = CHAMPION_ROSTER_NAMES.get(champion_id, [])
        resolved: list[dict] = []

        for name in roster_names:
            player = lookup_player(players_by_name_year, name, season_year)
            if player:
                resolved.append(player)
            else:
                warnings.append(f"{champion_id}: missing data for {name} ({season_year})")

        resolved.sort(key=lambda player: (-player["rating"], player["player"]))
        top_five = resolved[:5]
        display_names = [player["player"] for player in top_five]

        if len(display_names) < 5:
            warnings.append(
                f"{champion_id}: only {len(display_names)} rated players resolved "
                f"(wanted 5): {display_names}",
            )

        formatted = ", ".join(json.dumps(name) for name in display_names)
        lines.append(f"  '{champion_id}': [{formatted}],")

    lines.extend(
        [
            "} as const",
            "",
            "export function getChampionRoster(championId: string): readonly string[] {",
            "  return CHAMPION_ROSTERS[championId] ?? []",
            "}",
            "",
        ],
    )

    OUTPUT.write_text("\n".join(lines))

    print(f"Wrote {OUTPUT}")
    if warnings:
        print("\nWarnings:")
        for warning in warnings:
            print(f"  - {warning}")


if __name__ == "__main__":
    main()
