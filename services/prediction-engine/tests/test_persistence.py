import os

import pytest

import app.database as database


def test_validate_persistence_configuration_rejects_in_memory(monkeypatch):
    monkeypatch.setenv("BETMATE_REQUIRE_PERSISTENT_STORAGE", "true")
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("BETMATE_DB_PATH", ":memory:")

    with pytest.raises(RuntimeError, match="in-memory"):
        database.validate_persistence_configuration()


def test_create_sqlite_backup_writes_snapshot(tmp_path, monkeypatch):
    db_file = tmp_path / "source.sqlite3"
    db_file.write_text("sqlite-data", encoding="utf-8")
    backup_dir = tmp_path / "backups"

    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("BETMATE_DB_PATH", str(db_file))

    backup_path = database.create_sqlite_backup(str(backup_dir))

    assert backup_path is not None
    assert os.path.exists(backup_path)
    assert (backup_dir / os.path.basename(backup_path)).read_text(encoding="utf-8") == "sqlite-data"


def test_restore_sqlite_backup_overwrites_target(tmp_path, monkeypatch):
    source = tmp_path / "backup.sqlite3"
    target = tmp_path / "target.sqlite3"
    source.write_text("restored", encoding="utf-8")
    target.write_text("old", encoding="utf-8")

    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("BETMATE_DB_PATH", str(target))

    database.restore_sqlite_backup(str(source))
    assert target.read_text(encoding="utf-8") == "restored"
