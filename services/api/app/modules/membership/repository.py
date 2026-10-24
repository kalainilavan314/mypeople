"""Member profile queries.

npm.member and the geo tables are still owned by the Express migrations, so
they are read with SQL here (see app/modules/auth/repository.py for why).
"""

import uuid

from sqlalchemy import RowMapping, text
from sqlalchemy.orm import Session

# The area names follow server/src/db.js: the DS division is the one the
# member chose at sign-up, falling back to the one their GN division is in.
PROFILE_QUERY = text(
    """
    SELECT m.id, m.member_code, m.full_name, m.phone, m.dob, m.gender, m.language,
           m.tier, m.referral_code, m.verification_status, m.verified_at,
           m.district_code, d.name_en AS district_name,
           m.ds_code, ds.name_en AS ds_name,
           m.gs_code, g.name_en AS gs_name,
           m.created_at AS joined_at
    FROM npm.member m
    LEFT JOIN geo.gn_division g ON g.gn_code = m.gs_code
    LEFT JOIN geo.ds_division ds ON ds.ds_code = COALESCE(m.ds_code, g.ds_code)
    LEFT JOIN geo.district d ON d.district_code = m.district_code
    WHERE m.id = :id AND m.deleted_at IS NULL
    """
)


def find_member_profile(db: Session, member_id: uuid.UUID) -> RowMapping | None:
    return db.execute(PROFILE_QUERY, {"id": member_id}).mappings().one_or_none()
