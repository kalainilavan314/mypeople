from datetime import datetime
from typing import Self

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.analytics.service import Operations

_HIDDEN = "null when it would show a group of 1 to 9 people, directly or by subtraction"


class OperationsOut(CamelModel):
    """D32 operational figures for the viewer's areas over the last `periodDays` days."""

    period_days: int
    generated_at: datetime
    platform_wide: bool = Field(description="True when the figures cover every area")
    started: int | None = Field(description=f"Members who registered in the period; {_HIDDEN}")
    submitted: int | None = Field(description=f"Of them, sent their identity for review; {_HIDDEN}")
    verified: int | None = Field(description=f"Of them, identity verified; {_HIDDEN}")
    active: int | None = Field(description=f"Of them, membership Active; {_HIDDEN}")
    completion_rate: float | None = Field(description="active / started (KPI-01)")
    decided: int | None = Field(description=f"Identity reviews decided in the period; {_HIDDEN}")
    median_hours: float | None = Field(description="Median wait from submission to decision, in hours")
    within_target_rate: float | None = Field(description="Share decided within 5 working days (KPI-04)")
    waiting: int | None = Field(description=f"Reviews waiting on a reviewer now; {_HIDDEN}")
    over_target: int | None = Field(description=f"Of them, waiting more than 5 working days; {_HIDDEN}")
    events: int = Field(description="Published events held in the period")
    going: int | None = Field(description=f"Going answers for those events; {_HIDDEN}")
    attended: int | None = Field(description=f"Check-ins at those events; {_HIDDEN}")
    attendance_rate: float | None = Field(description="attended / going")

    @classmethod
    def build(cls, figures: Operations) -> Self:
        return cls(**figures.__dict__)
