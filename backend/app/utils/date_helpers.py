from datetime import date


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    days_in_month = [
        31,
        29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ][month - 1]
    day = min(value.day, days_in_month)
    return date(year, month, day)


def installment_schedule_date(
    due_start_date: date,
    frequency: str,
    index: int,
) -> date:
    from datetime import timedelta

    from backend.app.models.enums import CollectionFrequency

    if frequency == CollectionFrequency.WEEKLY.value:
        return due_start_date + timedelta(days=7 * index)
    if frequency == CollectionFrequency.BI_WEEKLY.value:
        return due_start_date + timedelta(days=14 * index)
    if frequency == CollectionFrequency.MONTHLY.value:
        return add_months(due_start_date, index)
    return due_start_date + timedelta(days=index)


def last_installment_date(
    due_start_date: date,
    frequency: str,
    installment_count: int,
) -> date:
    if installment_count <= 0:
        return due_start_date
    return installment_schedule_date(due_start_date, frequency, installment_count - 1)
