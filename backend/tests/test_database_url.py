from app.db.session import normalize_database_url


def test_render_postgres_url_uses_installed_psycopg3_driver():
    assert normalize_database_url("postgresql://user:pass@host:5432/app") == (
        "postgresql+psycopg://user:pass@host:5432/app"
    )


def test_legacy_postgres_url_uses_installed_psycopg3_driver():
    assert normalize_database_url("postgres://user:pass@host/app") == (
        "postgresql+psycopg://user:pass@host/app"
    )


def test_non_postgres_url_is_unchanged():
    assert normalize_database_url("sqlite:////tmp/test.db") == "sqlite:////tmp/test.db"
    assert normalize_database_url("postgresql+psycopg://user:pass@host/app") == (
        "postgresql+psycopg://user:pass@host/app"
    )
