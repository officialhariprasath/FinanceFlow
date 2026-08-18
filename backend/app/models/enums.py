from enum import Enum


class PaymentMode(str, Enum):
    CASH = "Cash"
    UPI = "UPI"
    BANK_TRANSFER = "Bank Transfer"
    CHEQUE = "Cheque"


class CapitalTransactionType(str, Enum):
    CAPITAL_ADDED = "CAPITAL_ADDED"
    LOAN_DISBURSEMENT = "LOAN_DISBURSEMENT"
    PRINCIPAL_RECOVERY = "PRINCIPAL_RECOVERY"
    PROFIT_REINVESTMENT = "PROFIT_REINVESTMENT"
    CAPITAL_WITHDRAWAL = "CAPITAL_WITHDRAWAL"
    CAPITAL_EXPENSE = "CAPITAL_EXPENSE"
    CAPITAL_ADJUSTMENT = "CAPITAL_ADJUSTMENT"


class LedgerDirection(str, Enum):
    CREDIT = "CREDIT"
    DEBIT = "DEBIT"


class CollectionModel(str, Enum):
    STANDARD = "STANDARD"
    DAILY_COLLECTION = "DAILY_COLLECTION"


class CollectionFrequency(str, Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    BI_WEEKLY = "BI_WEEKLY"
    MONTHLY = "MONTHLY"


class ExpenseFundingSource(str, Enum):
    PROFIT = "PROFIT"
    CAPITAL = "CAPITAL"


class ScheduleStatus(str, Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    PARTIAL = "PARTIAL"
    OVERDUE = "OVERDUE"


class AgentRole(str, Enum):
    COLLECTION_AGENT = "COLLECTION_AGENT"
    MANAGER = "MANAGER"
    VIEWER = "VIEWER"


class Permission(str, Enum):
    DASHBOARD = "dashboard"
    COLLECTIONS = "collections"
    CUSTOMERS = "customers"
    LOANS = "loans"
    PAYMENTS = "payments"
    CAPITAL = "capital"
    PROFIT = "profit"
    AGENTS = "agents"
    SETTINGS = "settings"
    SETTLEMENTS = "settlements"
    LEDGER = "ledger"
    EXPENSES = "expenses"
    REPORTS = "reports"


class WalletChannel(str, Enum):
    CASH = "CASH"
    UPI = "UPI"
    OTHER = "OTHER"


class AgentLedgerEntryType(str, Enum):
    COLLECTION = "COLLECTION"
    SETTLEMENT = "SETTLEMENT"
    REVERSAL = "REVERSAL"
    ADJUSTMENT = "ADJUSTMENT"


class SettlementStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"


class SettlementDeliveryMethod(str, Enum):
    CASH = "CASH"
    UPI = "UPI"
    BANK = "BANK"
    MIXED = "MIXED"


class ProfitTransactionType(str, Enum):
    PROFIT_RECOGNITION = "PROFIT_RECOGNITION"
    PROFIT_WITHDRAWAL = "PROFIT_WITHDRAWAL"
    PROFIT_REINVESTMENT = "PROFIT_REINVESTMENT"
    PROFIT_ADJUSTMENT = "PROFIT_ADJUSTMENT"
    EXPENSE = "EXPENSE"
    PRINCIPAL_LOSS = "PRINCIPAL_LOSS"