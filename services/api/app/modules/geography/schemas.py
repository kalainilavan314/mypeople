from app.core.schemas import CamelModel


class PlaceOut(CamelModel):
    code: str
    name_en: str | None
    name_ta: str | None
    name_si: str | None
