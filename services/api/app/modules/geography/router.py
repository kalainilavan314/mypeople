"""The geography registry as dependent lists: district, then DS division, then GN division
(BRD FR-REG-029, FR-REG-030, BR-017). Public reference data, needed before an account exists."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.core.schemas import CamelModel
from app.db.session import get_db
from app.modules.geography import repository
from app.modules.geography.repository import Place

router = APIRouter(prefix="/v1/geography", tags=["geography"])

Db = Annotated[Session, Depends(get_db)]
Code = Annotated[str, Path(max_length=20)]


class PlaceOut(CamelModel):
    code: str
    name_en: str | None
    name_ta: str | None
    name_si: str | None


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
