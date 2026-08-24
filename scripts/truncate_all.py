"""Truncate all application tables for a clean re-seed without docker volume wipe."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import text
from backend.app.database.session import SessionLocal


def main():
    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                """
                SELECT tablename
                FROM pg_tables
                WHERE schemaname = 'public'
                  AND tablename <> 'alembic_version'
                ORDER BY tablename
                """
            )
        ).fetchall()
        tables = [r[0] for r in rows]
        if not tables:
            print("No tables found.")
            return
        quoted = ", ".join(f'"{t}"' for t in tables)
        db.execute(text(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE"))
        db.commit()
        print(f"Truncated {len(tables)} tables:", ", ".join(tables))
    finally:
        db.close()


if __name__ == "__main__":
    main()
