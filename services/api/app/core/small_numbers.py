"""Small-number protection for area tables (BRD §8 "Small numbers hidden"; FR-DEV-008, FR-AST-012).

Counts by area are shown so that no group of 1 to 9 can be read, directly or by subtraction: every
district figure is shown, as None ("fewer than 10") when under 10; a DS division appears only where
its own count is 10 or more and what is left of its district's figure is 0 or 10 or more.
"""

SMALL_GROUP = 10


def area_table(rows: list[tuple[str, str | None, str, int]]) -> list[tuple[str, str, int | None]]:
    """From (district, DS division or None, key, count) to (area key, key, count or None)."""
    totals: dict[tuple[str, str], int] = {}
    shown: dict[tuple[str, str], list[tuple[str, int]]] = {}
    for district, ds, key, count in rows:
        totals[(district, key)] = totals.get((district, key), 0) + count
        if ds is not None and count >= SMALL_GROUP:
            shown.setdefault((district, key), []).append((ds, count))
    table: list[tuple[str, str, int | None]] = []
    divisions: list[tuple[str, str, int | None]] = []
    for (district, key), total in sorted(totals.items()):
        table.append((f"district:{district}", key, total if total >= SMALL_GROUP else None))
        cells = shown.get((district, key), [])
        remainder = total - sum(count for _, count in cells)
        if remainder == 0 or remainder >= SMALL_GROUP:
            divisions += [(f"ds:{ds}", key, count) for ds, count in cells]
    return table + sorted(divisions)
