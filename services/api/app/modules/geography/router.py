"""The geography registry as dependent lists: district, then DS division, then GN division
(BRD FR-REG-029, FR-REG-030, BR-017). Public reference data, needed before an account exists."""

import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.geography import repository
from app.modules.geography.repository import Place
from app.modules.geography.schemas import AreaNameOut, PlaceOut

router = APIRouter(prefix="/v1/geography", tags=["geography"])

Db = Annotated[Session, Depends(get_db)]
Code = Annotated[str, Path(max_length=20)]
AREA_KEY = re.compile(r"^(province|district|ds|gn):([A-Za-z0-9]{1,20})$")
MAX_KEYS = 100


def _out(places: list[Place] | None) -> list[PlaceOut]:
    if places is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return [PlaceOut(code=p.code, name_en=p.name_en, name_ta=p.name_ta, name_si=p.name_si) for p in places]


@router.get("/districts")
def list_districts(db: Db) -> list[PlaceOut]:
    return _out(repository.districts(db))


@router.get("/districts/{district_code}/ds-divisions", responses={404: {"description": "not_found"}})
def list_ds_divisions(district_code: Code, db: Db) -> list[PlaceOut]:
    return _out(repository.ds_divisions(db, district_code))


@router.get("/ds-divisions/{ds_code}/gn-divisions", responses={404: {"description": "not_found"}})
def list_gn_divisions(ds_code: Code, db: Db) -> list[PlaceOut]:
    return _out(repository.gn_divisions(db, ds_code))


@router.get("/areas", responses={422: {"description": "too_many_keys"}})
def name_areas(db: Db, key: Annotated[list[str], Query(description="Area keys such as district:LK41")] = []) -> list[AreaNameOut]:
    """Names for area keys as staff screens show them, instead of codes (public reference data like
    the lists above). "platform" and unknown or malformed keys are left out; at most 100 keys."""
    if len(key) > MAX_KEYS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="too_many_keys")
    codes_by_level: dict[str, list[str]] = {}
    for item in dict.fromkeys(key):
        match = AREA_KEY.match(item)
        if match:
            codes_by_level.setdefault(match.group(1), []).append(match.group(2))
    found = repository.area_names(db, codes_by_level)
    return [
        AreaNameOut(key=f"{level}:{code}", level=level, code=code, name_en=place.name_en, name_ta=place.name_ta)
        for (level, code), place in found.items()
    ]
