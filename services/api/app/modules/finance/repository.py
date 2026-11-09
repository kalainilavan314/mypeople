"""SQL repository for the finance module (M1.4)."""

import json
from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Row, text
from sqlalchemy.orm import Session


def find_by_id(db: Session, contribution_id: UUID, for_update: bool = False) -> Row | None:
    query = """
        SELECT c.*, m.member_code as donor_member_code, s.member_code as claimed_by_code
        FROM finance.contribution c
        JOIN npm.member m ON m.id = c.member_id
        LEFT JOIN npm.member s ON s.id = c.claimed_by
        WHERE c.id = :id
    """
    if for_update:
        query += " FOR UPDATE OF c"
    return db.execute(text(query), {"id": contribution_id}).one_or_none()


def find_by_member_and_idempotency(db: Session, member_id: UUID, idempotency_key: UUID) -> Row | None:
    return db.execute(
        text("SELECT * FROM finance.contribution WHERE member_id = :member_id AND idempotency_key = :idempotency_key"),
        {"member_id": member_id, "idempotency_key": idempotency_key},
    ).one_or_none()


def count_existing_bank_reference(db: Session, bank_reference: str, exclude_id: UUID | None = None) -> int:
    query = """
        SELECT count(*)
        FROM finance.contribution
        WHERE lower(trim(bank_reference)) = lower(trim(:ref))
          AND status NOT IN ('DRAFT', 'REJECTED')
    """
    params: dict[str, Any] = {"ref": bank_reference}
    if exclude_id is not None:
        query += " AND id != :exclude_id"
        params["exclude_id"] = exclude_id
    return db.execute(text(query), params).scalar_one() or 0


def insert_draft(
    db: Session,
    *,
    member_id: UUID,
    contribution_ref: str,
    amount_minor: int,
    transfer_date: date,
    bank_reference: str,
    idempotency_key: UUID,
    declaration_version: str,
    no_privilege_acknowledged: bool,
    information_accurate_acknowledged: bool,
    paying_for_self: bool,
    risk_flags: list[str],
) -> Row:
    return db.execute(
        text(
            """
            INSERT INTO finance.contribution (
                member_id, contribution_ref, amount_minor, currency, transfer_date,
                bank_reference, status, idempotency_key, declaration_version,
                no_privilege_acknowledged, information_accurate_acknowledged,
                paying_for_self, risk_flags
            ) VALUES (
                :member_id, :contribution_ref, :amount_minor, 'LKR', :transfer_date,
                :bank_reference, 'DRAFT', :idempotency_key, :declaration_version,
                :no_privilege, :accurate, :paying_for_self, CAST(:risk_flags AS jsonb)
            )
            RETURNING *
            """
        ),
        {
            "member_id": member_id,
            "contribution_ref": contribution_ref,
            "amount_minor": amount_minor,
            "transfer_date": transfer_date,
            "bank_reference": bank_reference.strip(),
            "idempotency_key": idempotency_key,
            "declaration_version": declaration_version,
            "no_privilege": no_privilege_acknowledged,
            "accurate": information_accurate_acknowledged,
            "paying_for_self": paying_for_self,
            "risk_flags": json.dumps(risk_flags),
        },
    ).one()


def get_latest_slip_version(db: Session, contribution_id: UUID) -> int:
    val = db.execute(
        text("SELECT COALESCE(MAX(version), 0) FROM finance.contribution_slip WHERE contribution_id = :id"),
        {"id": contribution_id},
    ).scalar_one()
    return int(val or 0)


def insert_slip(
    db: Session,
    *,
    contribution_id: UUID,
    version: int,
    encrypted_image: bytes,
    key_id: str,
    content_type: str,
    sha256: str,
) -> Row:
    slip = db.execute(
        text(
            """
            INSERT INTO finance.contribution_slip (
                contribution_id, version, encrypted_image, key_id, content_type, sha256
            ) VALUES (
                :contribution_id, :version, :encrypted_image, :key_id, :content_type, :sha256
            )
            RETURNING *
            """
        ),
        {
            "contribution_id": contribution_id,
            "version": version,
            "encrypted_image": encrypted_image,
            "key_id": key_id,
            "content_type": content_type,
            "sha256": sha256,
        },
    ).one()

    db.execute(
        text("UPDATE finance.contribution SET current_slip_id = :slip_id, updated_at = clock_timestamp() WHERE id = :id"),
        {"slip_id": slip.id, "id": contribution_id},
    )
    return slip


def get_current_slip(db: Session, contribution_id: UUID) -> Row | None:
    return db.execute(
        text(
            """
            SELECT s.*
            FROM finance.contribution_slip s
            JOIN finance.contribution c ON c.current_slip_id = s.id
            WHERE c.id = :id
            """
        ),
        {"id": contribution_id},
    ).one_or_none()


def get_slip_by_version(db: Session, contribution_id: UUID, version: int) -> Row | None:
    return db.execute(
        text("SELECT * FROM finance.contribution_slip WHERE contribution_id = :id AND version = :version"),
        {"id": contribution_id, "version": version},
    ).one_or_none()


def insert_slip_view_grant(
    db: Session,
    *,
    token_id: UUID,
    contribution_id: UUID,
    slip_version: int,
    viewer_id: UUID,
    expires_at: datetime,
) -> None:
    db.execute(
        text(
            """
            INSERT INTO finance.slip_view_grant (
                token_id, contribution_id, slip_version, viewer_id, expires_at
            ) VALUES (
                :token_id, :contribution_id, :slip_version, :viewer_id, :expires_at
            )
            """
        ),
        {
            "token_id": token_id,
            "contribution_id": contribution_id,
            "slip_version": slip_version,
            "viewer_id": viewer_id,
            "expires_at": expires_at,
        },
    )


def consume_slip_view_grant(
    db: Session,
    *,
    token_id: UUID,
    contribution_id: UUID,
    slip_version: int,
    viewer_id: UUID,
) -> bool:
    consumed = db.execute(
        text(
            """
            UPDATE finance.slip_view_grant
            SET used_at = clock_timestamp()
            WHERE token_id = :token_id
              AND contribution_id = :contribution_id
              AND slip_version = :slip_version
              AND viewer_id = :viewer_id
              AND used_at IS NULL
              AND expires_at > clock_timestamp()
            RETURNING token_id
            """
        ),
        {
            "token_id": token_id,
            "contribution_id": contribution_id,
            "slip_version": slip_version,
            "viewer_id": viewer_id,
        },
    ).scalar_one_or_none()
    return consumed is not None


def update_status(
    db: Session,
    contribution_id: UUID,
    new_status: str,
    risk_flags: list[str] | None = None,
) -> None:
    if risk_flags is not None:
        db.execute(
            text(
                """
                UPDATE finance.contribution
                SET status = :status, risk_flags = CAST(:risk_flags AS jsonb), updated_at = clock_timestamp()
                WHERE id = :id
                """
            ),
            {"id": contribution_id, "status": new_status, "risk_flags": json.dumps(risk_flags)},
        )
    else:
        db.execute(
            text("UPDATE finance.contribution SET status = :status, updated_at = clock_timestamp() WHERE id = :id"),
            {"id": contribution_id, "status": new_status},
        )


def insert_event(
    db: Session,
    *,
    contribution_id: UUID,
    from_status: str | None,
    to_status: str,
    actor_id: UUID | None,
    reason: str,
) -> None:
    db.execute(
        text(
            """
            INSERT INTO finance.contribution_event (
                contribution_id, from_status, to_status, actor_id, reason
            ) VALUES (
                :contribution_id, :from_status, :to_status, :actor_id, :reason
            )
            """
        ),
        {
            "contribution_id": contribution_id,
            "from_status": from_status,
            "to_status": to_status,
            "actor_id": actor_id,
            "reason": reason,
        },
    )


def get_events(db: Session, contribution_id: UUID) -> list[Row]:
    return list(
        db.execute(
            text("SELECT * FROM finance.contribution_event WHERE contribution_id = :id ORDER BY id ASC"),
            {"id": contribution_id},
        ).all()
    )


def claim(db: Session, contribution_id: UUID, reviewer_id: UUID) -> bool:
    """Takes a row lock and sets claimed_by if not claimed by another."""
    row = db.execute(
        text("SELECT claimed_by FROM finance.contribution WHERE id = :id FOR UPDATE"),
        {"id": contribution_id},
    ).one_or_none()
    if not row:
        return False
    if row.claimed_by is not None and row.claimed_by != reviewer_id:
        return False

    db.execute(
        text("UPDATE finance.contribution SET claimed_by = :reviewer, claimed_at = clock_timestamp() WHERE id = :id"),
        {"id": contribution_id, "reviewer": reviewer_id},
    )
    return True


def insert_reconciliation(
    db: Session,
    *,
    contribution_id: UUID,
    statement_reference: str,
    reviewed_by: UUID,
    reason: str,
) -> None:
    db.execute(
        text(
            """
            INSERT INTO finance.reconciliation (
                contribution_id, statement_reference, reviewed_by, reason
            ) VALUES (
                :contribution_id, :statement_ref, :reviewed_by, :reason
            )
            ON CONFLICT (contribution_id) DO NOTHING
            """
        ),
        {
            "contribution_id": contribution_id,
            "statement_ref": statement_reference,
            "reviewed_by": reviewed_by,
            "reason": reason,
        },
    )


def get_reconciliation(db: Session, contribution_id: UUID) -> Row | None:
    return db.execute(
        text("SELECT * FROM finance.reconciliation WHERE contribution_id = :id"),
        {"id": contribution_id},
    ).one_or_none()


def get_approval(db: Session, contribution_id: UUID) -> Row | None:
    return db.execute(
        text("SELECT * FROM finance.approval WHERE contribution_id = :id"),
        {"id": contribution_id},
    ).one_or_none()


def get_receipt(db: Session, contribution_id: UUID) -> Row | None:
    return db.execute(
        text("SELECT * FROM finance.receipt WHERE contribution_id = :id"),
        {"id": contribution_id},
    ).one_or_none()


def allocate_receipt_and_approve(
    db: Session,
    *,
    contribution_id: UUID,
    approved_by: UUID,
    reason: str,
    related_party_conflict: bool,
) -> Row:
    """Lock receipt counter singleton, increment, and record receipt + approval."""
    # 1. Lock the singleton counter
    counter = db.execute(
        text("SELECT last_number FROM finance.receipt_counter WHERE singleton = true FOR UPDATE")
    ).one()
    new_number = counter.last_number + 1
    if not 1 <= new_number <= 99999:
        raise ValueError("receipt_range_exhausted")

    db.execute(
        text("UPDATE finance.receipt_counter SET last_number = :num WHERE singleton = true"),
        {"num": new_number},
    )

    # 2. Insert receipt
    receipt = db.execute(
        text(
            """
            INSERT INTO finance.receipt (number, contribution_id)
            VALUES (:num, :contribution_id)
            RETURNING *
            """
        ),
        {"num": new_number, "contribution_id": contribution_id},
    ).one()

    # 3. Insert approval record
    db.execute(
        text(
            """
            INSERT INTO finance.approval (contribution_id, approved_by, reason, related_party_conflict)
            VALUES (:contribution_id, :approved_by, :reason, :conflict)
            """
        ),
        {
            "contribution_id": contribution_id,
            "approved_by": approved_by,
            "reason": reason,
            "conflict": related_party_conflict,
        },
    )

    return receipt


def list_for_member(db: Session, member_id: UUID, limit: int = 50, offset: int = 0) -> tuple[list[Row], int]:
    count = db.execute(
        text("SELECT count(*) FROM finance.contribution WHERE member_id = :member_id"),
        {"member_id": member_id},
    ).scalar_one()

    rows = db.execute(
        text(
            """
            SELECT c.*, r.number as receipt_number
            FROM finance.contribution c
            LEFT JOIN finance.receipt r ON r.contribution_id = c.id
            WHERE c.member_id = :member_id
            ORDER BY c.created_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {"member_id": member_id, "limit": limit, "offset": offset},
    ).all()

    return list(rows), int(count or 0)


def list_for_staff(
    db: Session,
    *,
    status: str | None = None,
    month: str | None = None,
    risk_flag: str | None = None,
    reference_search: str | None = None,
    claimed_by_me: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Row], int]:
    conditions = ["1=1"]
    params: dict[str, Any] = {"limit": limit, "offset": offset}

    if status:
        conditions.append("c.status = :status")
        params["status"] = status
    if month:
        conditions.append("to_char(c.transfer_date, 'YYYY-MM') = :month")
        params["month"] = month
    if risk_flag:
        conditions.append("c.risk_flags ? :risk_flag")
        params["risk_flag"] = risk_flag
    if reference_search:
        conditions.append(
            "(c.contribution_ref ILIKE :ref OR c.bank_reference ILIKE :ref OR m.member_code ILIKE :ref)"
        )
        params["ref"] = f"%{reference_search.strip()}%"
    if claimed_by_me:
        conditions.append("c.claimed_by = :claimed_by_me")
        params["claimed_by_me"] = claimed_by_me

    where_clause = " AND ".join(conditions)

    count = db.execute(
        text(
            f"""
            SELECT count(*)
            FROM finance.contribution c
            JOIN npm.member m ON m.id = c.member_id
            WHERE {where_clause}
            """
        ),
        params,
    ).scalar_one()

    rows = db.execute(
        text(
            f"""
            SELECT c.*, m.member_code as donor_member_code, s.member_code as claimed_by_name,
                   r.number as receipt_number
            FROM finance.contribution c
            JOIN npm.member m ON m.id = c.member_id
            LEFT JOIN npm.member s ON s.id = c.claimed_by
            LEFT JOIN finance.receipt r ON r.contribution_id = c.id
            WHERE {where_clause}
            ORDER BY c.created_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        params,
    ).all()

    return list(rows), int(count or 0)


def export_ledger_rows(db: Session, month: str) -> list[Row]:
    return list(
        db.execute(
            text(
                """
                SELECT c.contribution_ref,
                       c.transfer_date,
                       c.amount_minor,
                       c.currency,
                       c.bank_reference,
                       rec.statement_reference,
                       c.status,
                       r.number as receipt_number,
                       r.issued_at as receipt_issued_at,
                       m.member_code as donor_member_code
                FROM finance.contribution c
                JOIN npm.member m ON m.id = c.member_id
                LEFT JOIN finance.reconciliation rec ON rec.contribution_id = c.id
                LEFT JOIN finance.receipt r ON r.contribution_id = c.id
                WHERE to_char(c.transfer_date, 'YYYY-MM') = :month
                ORDER BY c.transfer_date ASC, c.created_at ASC
                """
            ),
            {"month": month},
        ).all()
    )
