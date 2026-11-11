from app.core.schemas import CamelModel


class PlaceOut(CamelModel):
    code: str
    name_en: str | None
    name_ta: str | None
    name_si: str | None


class AreaNameOut(CamelModel):
    """An area key such as district:LK41 with its names. Tamil names leave out the level word
    (district, province), which screens add; a name missing in Tamil is null."""

    key: str
    level: str
    code: str
    name_en: str | None
    name_ta: str | None
