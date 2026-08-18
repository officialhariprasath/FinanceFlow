import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.core.config import is_production, normalize_database_url

load_dotenv()

DATABASE_URL = normalize_database_url(os.getenv("DATABASE_URL"))

engine = create_engine(
    DATABASE_URL,
    echo=not is_production(),
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)
