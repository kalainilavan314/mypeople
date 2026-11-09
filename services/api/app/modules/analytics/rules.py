"""Small-group suppression for operational analytics (BRD RR-02, D32; MP-DEC-001 5.2) as plain functions.

A count of people from 1 to 9 is never shown, and neither is a figure that
would reveal such a group by subtraction from the figure before it. Zero is
shown: it identifies nobody. [ASSUMPTION] GOV-01 proposes 10 as the minimum
group; the DPO confirms it.
"""

MIN_GROUP = 10


def small(count: int) -> bool:
    return 0 < count < MIN_GROUP


def shown(count: int) -> int | None:
    """The count, or None when it is a small group."""
    return None if small(count) else count


def funnel(steps: list[int]) -> list[int | None]:
    """Each step of a funnel (every step a subset of the one before), hiding a step that is a small
    group itself or whose drop from the last shown step is one."""
    out: list[int | None] = []
    last_shown: int | None = None
    for count in steps:
        hidden = small(count) or (last_shown is not None and small(last_shown - count))
        out.append(None if hidden else count)
        if not hidden:
            last_shown = count
    return out


def share(part: int | None, whole: int | None) -> float | None:
    """part / whole, only when both may be shown and whole is not zero."""
    if part is None or whole is None or whole == 0:
        return None
    return round(part / whole, 3)
