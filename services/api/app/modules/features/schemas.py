from datetime import datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.features.service import FlagView


class FeaturesOut(CamelModel):
    """What the apps may show; a module that is off is hidden, never shown broken."""

    enabled: list[str]


class FlagOut(CamelModel):
    key: str
    name_en: str
    phase: int
    required_gate: Literal["G0", "G1", "G2", "G3"]
    enabled: bool
    gate: Literal["G0", "G1", "G2", "G3"] | None
    approval_ref: str | None
    gate_recorded_at: datetime | None

    @classmethod
    def build(cls, view: FlagView) -> "FlagOut":
        stored = view.stored
        return cls(
            key=view.feature.key,
            name_en=view.feature.name_en,
            phase=view.feature.phase,
            required_gate=view.feature.gate,
            enabled=view.enabled,
            gate=stored.gate if stored else None,  # type: ignore[arg-type]
            approval_ref=stored.approval_ref if stored else None,
            gate_recorded_at=stored.gate_recorded_at if stored else None,
        )


class GateIn(CamelModel):
    gate: Literal["G0", "G1", "G2", "G3"]
    approval_ref: str = Field(min_length=3, max_length=200, description="The sign-off record, e.g. a decision or minutes reference")
    reason: str = Field(min_length=3, max_length=1000)


class SwitchIn(CamelModel):
    reason: str = Field(min_length=3, max_length=1000)
