"""Wipe all application data and re-run migrations (fresh database)."""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    print("Stopping containers and removing postgres volume...")
    subprocess.run(
        ["docker", "compose", "down", "-v"],
        cwd=ROOT,
        check=False,
    )
    subprocess.run(["docker", "rm", "-f", "finnect-postgres"], check=False)
    print("Starting postgres...")
    subprocess.run(
        ["docker", "compose", "up", "-d"],
        cwd=ROOT,
        check=True,
    )
    # Wait for postgres
    import time

    for _ in range(30):
        r = subprocess.run(
            [
                "docker",
                "exec",
                "finnect-postgres",
                "pg_isready",
                "-U",
                "finnect",
                "-d",
                "finnect",
            ],
            capture_output=True,
        )
        if r.returncode == 0:
            break
        time.sleep(1)
    else:
        print("Postgres did not become ready.")
        sys.exit(1)

    venv_python = ROOT / ".venv" / "Scripts" / "python.exe"
    if not venv_python.exists():
        venv_python = ROOT / ".venv" / "bin" / "python"

    print("Running alembic upgrade head...")
    subprocess.run(
        [str(venv_python), "-m", "alembic", "upgrade", "head"],
        cwd=ROOT,
        check=True,
        env={**os.environ},
    )
    print("Database reset complete.")


if __name__ == "__main__":
    main()
