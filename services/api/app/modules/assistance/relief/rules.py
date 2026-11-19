"""Relief logistics rules (BRD v1.1 FR-DIS-005, S16, D26, BR-102) as plain functions.

Relief supplies and what was handed out are recorded under the same political-neutrality firewall as
Community Support: a recipient is a Community Support case (by its AS- reference) or a group at a
site with the number of households, never a name, a membership or anything about political support.
Stock is kept per store (a District or DS division) and item, and nothing can be handed out that the
store does not hold (S16's quantity checks).
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

PERMISSION = "relief.logistics"  # PRM-54

Item = Literal[
    "rice", "dry_rations", "drinking_water", "cooked_meals", "clothing", "mats_blankets", "hygiene_kits", "tarpaulins",
    "baby_food", "kitchen_sets",
]
Unit = Literal["kg", "packs", "litres", "meals", "pieces", "kits", "sets"]


@dataclass(frozen=True)
class ItemKind:
    key: Item
    unit: Unit
    name_en: str
    name_ta: str


# [ASSUMPTION] The relief items and their units, until the District Secretariats' lists are confirmed; one
# unit per item keeps the stock sums honest.
ITEMS: tuple[ItemKind, ...] = (
    ItemKind("rice", "kg", "Rice", "அரிசி"),
    ItemKind("dry_rations", "packs", "Dry rations", "உலர் உணவுப் பொதிகள்"),
    ItemKind("drinking_water", "litres", "Drinking water", "குடிநீர்"),
    ItemKind("cooked_meals", "meals", "Cooked meals", "சமைத்த உணவு"),
    ItemKind("clothing", "pieces", "Clothing", "உடைகள்"),
    ItemKind("mats_blankets", "pieces", "Mats and blankets", "பாய்களும் போர்வைகளும்"),
    ItemKind("hygiene_kits", "kits", "Hygiene kits", "சுகாதாரப் பொதிகள்"),
    ItemKind("tarpaulins", "pieces", "Tarpaulins", "தார்ப்பாய்கள்"),
    ItemKind("baby_food", "packs", "Baby food", "குழந்தை உணவு"),
    ItemKind("kitchen_sets", "sets", "Kitchen sets", "சமையல் பாத்திரத் தொகுதிகள்"),
)
ITEM_KINDS = {item.key: item for item in ITEMS}

STORE_LEVELS = ("district", "ds")
DELIVERY_LEVELS = ("district", "ds", "gn")
# [ASSUMPTION] A record is made within 30 days of the delivery or receipt it describes.
LATEST_RECORD = timedelta(days=30)
CASE_REF = r"^AS-[A-Z2-7]{8}$"

RecipientKind = Literal["case", "group"]


def check_dates(day: date, today: date) -> list[str]:
    if day > today:
        return ["date_in_future"]
    if today - day > LATEST_RECORD:
        return ["date_too_old"]
    return []


def check_store(store_level: str) -> list[str]:
    return [] if store_level in STORE_LEVELS else ["store_level"]


def check_delivery(*, store_key: str, delivered_path_keys: list[str], delivered_level: str) -> list[str]:
    """Relief from a store goes to places inside that store's District or DS division [ASSUMPTION]."""
    problems = []
    if delivered_level not in DELIVERY_LEVELS:
        problems.append("delivery_level")
    elif store_key not in delivered_path_keys:
        problems.append("outside_store_area")
    return problems


def check_quantity(quantity: int, balance: int) -> list[str]:
    """S16: nothing is handed out that the store does not hold."""
    return ["more_than_in_stock"] if quantity > balance else []


def check_recipient(*, kind: str, case_found: bool, group_site: str | None, households: int | None) -> list[str]:
    """FR-DIS-005: an AS- case, or a group at a site with how many households; never a person's name."""
    if kind == "case":
        return [] if case_found else ["case_not_found"]
    if not (group_site and group_site.strip() and households):
        return ["group_details_required"]
    return []
