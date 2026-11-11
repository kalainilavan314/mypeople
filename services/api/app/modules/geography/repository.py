"""SQL for the geography registry (geo.*, created by the Express migration 0000)."""

import re
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Place:
    code: str
    name_en: str | None
    name_ta: str | None
    name_si: str | None


def districts(db: Session) -> list[Place]:
    """Districts that have DS divisions. Older rows without any (codes without the LK
    prefix, left over in some databases) cannot be chosen down to a GN division."""
    rows = db.execute(
        text(
            """
            SELECT d.district_code AS code, d.name_en, d.name_ta, d.name_si FROM geo.district d
            WHERE EXISTS (SELECT 1 FROM geo.ds_division s WHERE s.district_code = d.district_code)
            ORDER BY d.name_en
            """
        )
    ).mappings()
    return [Place(**row) for row in rows]


def ds_divisions(db: Session, district_code: str) -> list[Place] | None:
    """None when the district does not exist."""
    if not db.scalar(text("SELECT EXISTS (SELECT 1 FROM geo.district WHERE district_code = :c)"), {"c": district_code}):
        return None
    rows = db.execute(
        text(
            """
            SELECT ds_code AS code, name_en, name_ta, name_si FROM geo.ds_division
            WHERE district_code = :code ORDER BY name_en
            """
        ),
        {"code": district_code},
    ).mappings()
    return [Place(**row) for row in rows]


def gn_divisions(db: Session, ds_code: str) -> list[Place] | None:
    if not db.scalar(text("SELECT EXISTS (SELECT 1 FROM geo.ds_division WHERE ds_code = :c)"), {"c": ds_code}):
        return None
    rows = db.execute(
        text(
            """
            SELECT gn_code AS code, name_en, name_ta, name_si FROM geo.gn_division
            WHERE ds_code = :code ORDER BY name_en
            """
        ),
        {"code": ds_code},
    ).mappings()
    return [Place(**row) for row in rows]


# The table and code column for each area level below the platform.
_LEVEL_TABLES = {
    "province": ("geo.province", "province_code"),
    "district": ("geo.district", "district_code"),
    "ds": ("geo.ds_division", "ds_code"),
    "gn": ("geo.gn_division", "gn_code"),
}

# Some Tamil district and province names in the registry end in the level word, cut short in the
# source data ("யாழ்ப்பாணம் மாவட்"). Screens add the level word themselves, so it is removed here.
_TAMIL_LEVEL_WORD = {"district": re.compile(r"\s*மாவ\S*$"), "province": re.compile(r"\s*மாகாண\S*$")}


def area_names(db: Session, codes_by_level: dict[str, list[str]]) -> dict[tuple[str, str], Place]:
    """Names for the given codes at each level, keyed by (level, code). Unknown codes are left out."""
    found: dict[tuple[str, str], Place] = {}
    for level, codes in codes_by_level.items():
        table, column = _LEVEL_TABLES[level]
        rows = db.execute(
            text(f"SELECT {column} AS code, name_en, name_ta, name_si FROM {table} WHERE {column} = ANY(:codes)"),
            {"codes": codes},
        ).mappings()
        for row in rows:
            place = Place(**row)
            pattern = _TAMIL_LEVEL_WORD.get(level)
            if pattern and place.name_ta:
                place = Place(place.code, place.name_en, pattern.sub("", place.name_ta) or None, place.name_si)
            found[(level, place.code)] = place
    return found
