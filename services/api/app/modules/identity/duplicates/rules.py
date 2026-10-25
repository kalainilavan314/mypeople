"""Duplicate investigation rules (BRD FR-IDV-010, BR-094, PRM-28, D04) as plain functions.

An investigation decides whether two accounts belong to one person. Its
outcome is a finding only: any change to either account (for example
inactivating one) is a separate authorised action with its own reason
(BR-015), so nothing is merged, suspended or rejected automatically (BR-094).

The automatic signal, the same name and date of birth on two accounts, is
an [ASSUMPTION]: the BRD names keyed hashes, contact details and approved
face similarity, but NIC hashes and phone numbers are already unique at
sign-up, and face comparison waits on OD-28.
"""

import re
import uuid
from typing import Literal

INVESTIGATE = "idv.duplicate.investigate"  # PRM-28
REPORT = "members.verify"  # a reviewer may report a suspected duplicate from an open review

Signal = Literal["profile_match", "reported"]
CaseState = Literal["open", "in_review", "not_duplicate", "duplicate_confirmed"]
Outcome = Literal["not_duplicate", "duplicate_confirmed"]


def comparable_name(full_name: str) -> str:
    """Names compared without case or extra spaces, as the database index does."""
    return re.sub(r"\s+", " ", full_name.strip()).lower()


def ordered_pair(first: uuid.UUID, second: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    """One case per pair of accounts, whichever was found first."""
    return (first, second) if first < second else (second, first)


def check_report(reporter_id: uuid.UUID, member_id: uuid.UUID, other_member_id: uuid.UUID) -> list[str]:
    if member_id == other_member_id:
        return ["same_member"]
    if reporter_id in (member_id, other_member_id):
        return ["own_record"]
    return []


def check_claim(
    state: CaseState, claimed_by: object | None, actor_id: object, claimant_still_authorised: bool, *, opened_by: object | None
) -> str | None:
    """One investigator at a time; a claim held by someone who lost the permission can be taken over.

    Whoever reported the suspicion never investigates it: claiming opens both accounts'
    evidence, and a report must not be a way to reach a second member's images."""
    if state not in ("open", "in_review"):
        return "not_open"
    if opened_by is not None and opened_by == actor_id:
        return "reported_by_you"
    if claimed_by is None or claimed_by == actor_id or not claimant_still_authorised:
        return None
    return "claimed_by_another"
