#!/usr/bin/env python3
"""
Migrate FinanceFlow Postgres data to Neon (or any target DATABASE_URL).

Usage:
  # After deploying admin/database-export endpoint:
  set FINNECT_API_BASE_URL=https://financeflow-api-gf0x.onrender.com
  set NEON_DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
  set OWNER_EMAIL=owner@financeflow.demo
  set OWNER_PASSWORD=Owner@12345
  python scripts/migrate_to_neon.py

Or with an existing export file:
  python scripts/migrate_to_neon.py --import-only exports/financeflow-db-export.json
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from scripts.api_config import api_base  # noqa: E402


def _request(method: str, path: str, *, token: str | None = None, form: str | None = None):
    url = f"{api_base()}{path}"
    headers: dict[str, str] = {}
    body = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if form is not None:
        body = form.encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=180) as resp:
        raw = resp.read()
        if "application/json" in resp.headers.get("Content-Type", ""):
            return json.loads(raw.decode())
        return raw


def owner_login(email: str, password: str) -> str:
    form = urllib.parse.urlencode({"username": email, "password": password})
    data = _request("POST", "/finance-owners/login", form=form)
    return data["access_token"]


def download_export(token: str, out_path: Path) -> dict:
    url = f"{api_base()}/admin/database-export"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        raw = resp.read()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(raw)
    return json.loads(raw.decode())


def run_alembic(target_url: str) -> None:
    env = {**os.environ, "DATABASE_URL": target_url}
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=_ROOT,
        env=env,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError("alembic upgrade head failed on target database")


def _coerce(value):
    if value is None:
        return None
    if isinstance(value, str):
        if len(value) >= 10 and value[4:5] == "-" and value[7:8] == "-":
            try:
                if "T" in value:
                    return datetime.fromisoformat(value.replace("Z", "+00:00"))
                return date.fromisoformat(value)
            except ValueError:
                pass
        try:
            if "." in value:
                return Decimal(value)
        except Exception:
            pass
    return value


def import_to_target(export: dict, target_url: str) -> None:
    import psycopg2
    from psycopg2.extras import execute_batch

    tables: dict[str, list[dict]] = export["tables"]
    conn = psycopg2.connect(target_url)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        cur.execute("SET session_replication_role = replica")

        table_names = list(tables.keys())
        if table_names:
            quoted = ", ".join(f'"{t}"' for t in table_names)
            cur.execute(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE")

        for table, rows in tables.items():
            if not rows:
                continue
            columns = list(rows[0].keys())
            col_sql = ", ".join(f'"{c}"' for c in columns)
            placeholders = ", ".join(["%s"] * len(columns))
            sql = f'INSERT INTO "{table}" ({col_sql}) VALUES ({placeholders})'
            values = [
                tuple(_coerce(row.get(c)) for c in columns)
                for row in rows
            ]
            execute_batch(cur, sql, values, page_size=200)

        cur.execute("SET session_replication_role = DEFAULT")

        for table in tables:
            cur.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = %s
                  AND column_default LIKE 'nextval%%'
                """,
                (table,),
            )
            serial_cols = [r[0] for r in cur.fetchall()]
            for col in serial_cols:
                cur.execute(
                    f'SELECT COALESCE(MAX("{col}"), 0) FROM "{table}"'
                )
                max_id = cur.fetchone()[0]
                cur.execute("SELECT pg_get_serial_sequence(%s, %s)", (table, col))
                seq = cur.fetchone()[0]
                if seq and max_id:
                    cur.execute("SELECT setval(%s, %s, true)", (seq, max_id))

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def verify(target_url: str) -> dict:
    import psycopg2

    conn = psycopg2.connect(target_url)
    cur = conn.cursor()
    checks = {}
    for table in (
        "finance_owners",
        "customers",
        "loans",
        "payments",
        "agents",
    ):
        cur.execute(f'SELECT COUNT(*) FROM "{table}"')
        checks[table] = cur.fetchone()[0]
    cur.close()
    conn.close()
    return checks


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate Render Postgres data to Neon")
    parser.add_argument(
        "--import-only",
        help="Path to existing financeflow-db-export.json (skip live export)",
    )
    parser.add_argument(
        "--skip-alembic",
        action="store_true",
        help="Skip alembic upgrade on target (schema already exists)",
    )
    args = parser.parse_args()

    target_url = os.environ.get("NEON_DATABASE_URL") or os.environ.get("TARGET_DATABASE_URL")
    if not target_url:
        print("Set NEON_DATABASE_URL to your Neon connection string.")
        return 1
    if "channel_binding=require" in target_url:
        target_url = target_url.replace("&channel_binding=require", "").replace(
            "?channel_binding=require&", "?"
        ).replace("?channel_binding=require", "")

    export_path = Path(args.import_only) if args.import_only else _ROOT / "exports" / "financeflow-db-export.json"

    if args.import_only:
        export = json.loads(export_path.read_text(encoding="utf-8"))
        print(f"Loaded export from {export_path}")
    else:
        email = os.environ.get("OWNER_EMAIL", "owner@financeflow.demo")
        password = os.environ.get("OWNER_PASSWORD", "Owner@12345")
        print(f"Logging in to {api_base()} as {email}...")
        token = owner_login(email, password)
        print("Downloading database export from live API...")
        try:
            export = download_export(token, export_path)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode(errors="replace")
            print(f"Export failed ({exc.code}): {body[:500]}")
            print("Deploy latest code first (admin/database-export endpoint).")
            return 1
        print(f"Saved export to {export_path}")

    print("Export counts:", export.get("counts", {}))

    if not args.skip_alembic:
        print("Running alembic upgrade head on Neon...")
        run_alembic(target_url)

    print("Importing data into Neon...")
    import_to_target(export, target_url)

    counts = verify(target_url)
    print("Neon verification counts:", counts)
    print("\nMigration import complete.")
    print("Next: Render dashboard -> financeflow-api -> Environment -> set DATABASE_URL to Neon URL -> Save.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.URLError as exc:
        print("Network error:", exc)
        raise SystemExit(1) from exc
    except Exception as exc:
        print("Migration failed:", exc)
        raise SystemExit(1) from exc
