from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from backend.app.models.enums import CollectionModel


def is_installment_loan(loan) -> bool:
    return loan.collection_model == CollectionModel.DAILY_COLLECTION.value


def is_installment_collection_model(collection_model: str | None) -> bool:
    return collection_model == CollectionModel.DAILY_COLLECTION.value
