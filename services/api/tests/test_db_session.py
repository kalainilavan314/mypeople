import pytest

from app.db.session import to_sqlalchemy_url


@pytest.mark.parametrize(
    ("database_url", "expected"),
    [
        ("postgresql://member@localhost:5432/db", "postgresql+psycopg://member@localhost:5432/db"),
        ("postgres://member@db.example/db?sslmode=require", "postgresql+psycopg://member@db.example/db?sslmode=require"),
        ("postgresql+psycopg://member@localhost/db", "postgresql+psycopg://member@localhost/db"),
    ],
)
def test_express_style_urls_get_the_psycopg_driver(database_url, expected):
    assert to_sqlalchemy_url(database_url) == expected
