"""Declarative base for ORM models, and the rule for which tables Alembic manages."""

from typing import Any

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def include_object(obj: Any, name: str | None, type_: str, reflected: bool, compare_to: Any) -> bool:
    """Limit Alembic autogenerate to tables declared on Base.metadata.

    The database also holds the tables created by the Express migrations, which
    no model describes yet. Without this filter, autogenerate would propose
    dropping every one of them.
    """
    if type_ == "table" and reflected and compare_to is None:
        return False
    return True
