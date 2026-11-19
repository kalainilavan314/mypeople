"""Request and response bodies for relief logistics (S16, D26). Class names start with Relief."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.assistance.relief import rules
from app.modules.assistance.relief.repository import Distribution, StockLine, Supply
from app.modules.assistance.relief.rules import Item, RecipientKind, Unit


class ReliefItemOut(CamelModel):
    key: Item
    unit: Unit
    name_en: str
    name_ta: str


def items() -> list[ReliefItemOut]:
    return [ReliefItemOut(key=i.key, unit=i.unit, name_en=i.name_en, name_ta=i.name_ta) for i in rules.ITEMS]


class ReliefStockOut(CamelModel):
    store_key: str
    item: Item
    unit: Unit
    received: int
    handed_out: int
    balance: int

    @classmethod
    def build(cls, line: StockLine) -> "ReliefStockOut":
        return cls(store_key=line.store_key, item=line.item, unit=rules.ITEM_KINDS[line.item].unit,  # type: ignore[arg-type,index]
                   received=line.received, handed_out=line.handed_out, balance=line.received - line.handed_out)


class ReliefOverviewOut(CamelModel):
    """S16 and D26: the items, and the stock of every store in the officer's areas."""

    items: list[ReliefItemOut]
    stock: list[ReliefStockOut]


class ReliefAreaIn(CamelModel):
    level: Literal["district", "ds", "gn"]
    code: str = Field(min_length=2, max_length=20)


class ReliefSupplyIn(CamelModel):
    store: ReliefAreaIn = Field(description="The District or DS division whose store received it")
    item: Item
    quantity: int = Field(ge=1, le=1000000)
    supplier: str = Field(min_length=2, max_length=200)
    received_on: date
    alert_id: uuid.UUID | None = None


class ReliefSupplyOut(CamelModel):
    id: uuid.UUID
    store_key: str
    item: Item
    unit: Unit
    quantity: int
    supplier: str
    received_on: date
    alert_id: uuid.UUID | None
    created_at: datetime

    @classmethod
    def build(cls, s: Supply) -> "ReliefSupplyOut":
        return cls(id=s.id, store_key=s.store_key, item=s.item, unit=rules.ITEM_KINDS[s.item].unit,  # type: ignore[arg-type,index]
                   quantity=s.quantity, supplier=s.supplier, received_on=s.received_on, alert_id=s.alert_id,
                   created_at=s.created_at)


class ReliefDistributionIn(CamelModel):
    """S16: never a recipient's name (FR-DIS-005): an AS- case reference, or a group at a site."""

    store_key: str = Field(min_length=3, max_length=40, description="The store it came from, such as ds:LK4103")
    area: ReliefAreaIn = Field(description="Where it was handed out")
    item: Item
    quantity: int = Field(ge=1, le=1000000)
    recipient_kind: RecipientKind
    case_ref: str | None = Field(default=None, max_length=12, description="For a case: its AS- reference")
    group_site: str | None = Field(default=None, max_length=200, description="For a group: the shelter or site")
    households: int | None = Field(default=None, ge=1, le=100000)
    evidence: str = Field(min_length=3, max_length=500, description="The signed list or photo reference")
    delivered_on: date
    alert_id: uuid.UUID | None = None


class ReliefDistributionOut(CamelModel):
    id: uuid.UUID
    distribution_ref: str
    store_key: str
    area_key: str
    item: Item
    unit: Unit
    quantity: int
    recipient_kind: RecipientKind
    case_ref: str | None
    group_site: str | None
    households: int | None
    evidence: str
    delivered_on: date
    alert_id: uuid.UUID | None
    created_at: datetime

    @classmethod
    def build(cls, d: Distribution, case_ref: str | None) -> "ReliefDistributionOut":
        return cls(id=d.id, distribution_ref=d.distribution_ref, store_key=d.store_key, area_key=d.area_key,
                   item=d.item, unit=rules.ITEM_KINDS[d.item].unit,  # type: ignore[arg-type,index]
                   quantity=d.quantity, recipient_kind=d.recipient_kind, case_ref=case_ref,  # type: ignore[arg-type]
                   group_site=d.group_site, households=d.households, evidence=d.evidence, delivered_on=d.delivered_on,
                   alert_id=d.alert_id, created_at=d.created_at)
