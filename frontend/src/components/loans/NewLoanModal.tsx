import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";

import { createLoan } from "../../services/loanService";
import { getAgents } from "../../services/agentService";
import type { Agent } from "../../types/agent";
import { createCustomer } from "../../services/customerService";
import { getCapitalSummary } from "../../services/capitalService";
import {
  getCustomerCreditScore,
  refreshCustomerCreditScore,
} from "../../services/creditScoreService";
import {
  getLoanApprovalFlags,
  submitLoanApproval,
} from "../../services/loanApprovalService";
import CreditScoreCard from "../credit/CreditScoreCard";
import BorrowerKycForm from "../customers/BorrowerKycForm";
import api from "../../api/axios";
import type { LoanCreate } from "../../types/loan";
import type { CustomerCreate } from "../../types/customer";
import type { CreditScore } from "../../types/creditScore";
import { fmt } from "../../utils/fmt";
import {
  calculateInstallmentLoanTerms,
  dueDateFromStart,
  FREQUENCY_COUNT_LABELS,
  FREQUENCY_LABELS,
  installmentAmountLabel,
  type CollectionFrequency,
} from "../../utils/loanCalc";

interface CustomerOption {
  id: number;
  full_name: string;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  preselectedCustomerId?: number;
}

type CustomerMode = "existing" | "new";

const DEFAULT_PRINCIPAL = "10000";
const DEFAULT_INTEREST = "20";
const DEFAULT_COUNT = "100";

const FREQUENCIES: CollectionFrequency[] = [
  "DAILY",
  "WEEKLY",
  "BI_WEEKLY",
  "MONTHLY",
];

export default function NewLoanModal({
  onClose,
  onSuccess,
  preselectedCustomerId,
}: Props) {
  const { hasPermission } = useAuth();
  const canCreateCustomer = hasPermission("customers.create");

  const [mode, setMode] = useState<CustomerMode>("existing");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(
    preselectedCustomerId ?? 0
  );
  const [pendingNewCustomer, setPendingNewCustomer] =
    useState<CustomerCreate | null>(null);

  const [creditScore, setCreditScore] = useState<CreditScore | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreRefreshing, setScoreRefreshing] = useState(false);

  const [frequency, setFrequency] = useState<CollectionFrequency>("DAILY");
  const [principalAmount, setPrincipalAmount] = useState(DEFAULT_PRINCIPAL);
  const [interestPercent, setInterestPercent] = useState(DEFAULT_INTEREST);
  const [installmentCount, setInstallmentCount] = useState(DEFAULT_COUNT);
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dueStartDate, setDueStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [availableCapital, setAvailableCapital] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [collectionAgentId, setCollectionAgentId] = useState<number>(0);
  const [canCreateLive, setCanCreateLive] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);

  const count = Number(installmentCount) || 0;

  const terms = useMemo(() => {
    const principal = Number(principalAmount) || 0;
    const interest = Number(interestPercent) || 0;
    if (principal <= 0 || count <= 0) return null;
    return calculateInstallmentLoanTerms(principal, interest, count);
  }, [principalAmount, interestPercent, count]);

  const dueDate = useMemo(
    () => dueDateFromStart(dueStartDate, frequency, count),
    [dueStartDate, frequency, count]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    api
      .get<CustomerOption[]>("/customers/names")
      .then((r) => setCustomers(r.data))
      .catch(() => {});

    getAgents()
      .then((list) => {
        const active = list.filter((a) => a.is_active);
        setAgents(active);
        if (active.length === 1) setCollectionAgentId(active[0].id);
      })
      .catch(() => setAgents([]));

    getCapitalSummary()
      .then((s) =>
        setAvailableCapital(s.available_to_lend ?? s.available_capital)
      )
      .catch(() => {});

    getLoanApprovalFlags()
      .then((f) => {
        setCanCreateLive(f.can_create_live);
        setRequireApproval(f.require_approval);
      })
      .catch(() => {
        setCanCreateLive(hasPermission("loans.create"));
        setRequireApproval(!hasPermission("loans.create"));
      });
  }, [hasPermission]);

  useEffect(() => {
    const customerId =
      mode === "existing" ? selectedCustomerId || preselectedCustomerId || 0 : 0;
    if (!customerId) {
      setCreditScore(null);
      return;
    }
    let cancelled = false;
    setScoreLoading(true);
    getCustomerCreditScore(customerId)
      .then((score) => {
        if (!cancelled) setCreditScore(score);
      })
      .catch(() => {
        if (!cancelled) setCreditScore(null);
      })
      .finally(() => {
        if (!cancelled) setScoreLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, selectedCustomerId, preselectedCustomerId]);

  useEffect(() => {
    if (dueStartDate < issueDate) {
      setDueStartDate(issueDate);
    }
  }, [issueDate, dueStartDate]);

  function validate(): boolean {
    const e: Record<string, string> = {};

    if (mode === "existing" && !selectedCustomerId) {
      e.customer_id = "Select a borrower.";
    }
    if (mode === "new" && !pendingNewCustomer) {
      e.new_customer = "Complete borrower KYC first.";
    }
    if (Number(principalAmount) <= 0) e.principal_amount = "Invalid principal.";
    if (Number(interestPercent) <= 0) e.interest_percent = "Invalid interest %.";
    if (count <= 0) e.installment_count = "Invalid count.";
    if (dueStartDate < issueDate) {
      e.due_start_date = "First collection cannot be before issue date.";
    }
    if (
      availableCapital !== null &&
      canCreateLive &&
      Number(principalAmount) > Number(availableCapital)
    ) {
      e.capital = "Insufficient available capital.";
    }
    if (agents.length > 0 && !collectionAgentId) {
      e.collection_agent_id = "Select which agent will collect this loan.";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !terms) return;

    try {
      setSaving(true);
      setApiError("");

      let customerId = selectedCustomerId;
      if (mode === "new" && pendingNewCustomer) {
        const created = await createCustomer(pendingNewCustomer);
        customerId = created.id;
      }

      const loanTerms = {
        customer_id: customerId,
        principal_amount: principalAmount,
        interest_rate: "0",
        collection_frequency: frequency,
        installment_count: count,
        issue_date: issueDate,
        due_start_date: dueStartDate,
        daily_payment: terms.installmentAmount.toFixed(2),
        daily_principal: terms.installmentPrincipal.toFixed(2),
        daily_profit: terms.installmentProfit.toFixed(2),
        collection_agent_id: collectionAgentId || undefined,
      };

      if (!canCreateLive || requireApproval) {
        await submitLoanApproval(loanTerms);
      } else {
        const payload: LoanCreate = {
          ...loanTerms,
          interest_method: "DAILY_COLLECTION",
          due_date: dueDate,
          collection_model: "DAILY_COLLECTION",
          duration_days: frequency === "DAILY" ? count : undefined,
        };
        await createLoan(payload);
      }

      onSuccess();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      let message = requireApproval
        ? "Failed to submit for approval."
        : "Failed to create loan.";
      if (typeof detail === "string") message = detail;
      else if (Array.isArray(detail)) {
        message = detail
          .map((d) => (typeof d === "object" && d && "msg" in d ? String((d as { msg: string }).msg) : String(d)))
          .join("; ");
      }
      setApiError(message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (key: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm ${
      errors[key] ? "border-red-400" : "border-slate-300"
    }`;

  const primaryLabel = saving
    ? requireApproval || !canCreateLive
      ? "Submitting…"
      : "Creating…"
    : requireApproval || !canCreateLive
      ? "Submit for approval"
      : "Create Loan";

  return (
    <div className="modal-backdrop">
      <div className="surface-card-xl flex max-h-[90dvh] flex-col overflow-hidden">
        <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            New Loan
          </h2>
          <p className="text-sm text-slate-500">
            {requireApproval || !canCreateLive
              ? "This loan will be submitted for owner/manager approval — no capital moves until approved."
              : "Choose collection frequency — amounts and schedule are auto-calculated"}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-6 py-5 dark:bg-slate-800">
          {apiError && (
            <div className="alert-error mb-4 rounded-lg border p-3 text-sm text-red-700">
              {apiError}
            </div>
          )}

          {availableCapital !== null && (
            <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
              Available to lend:{" "}
              <span className="font-semibold">{fmt(availableCapital)}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {!preselectedCustomerId && (
              <div className="flex overflow-hidden rounded-lg border">
                <button
                  type="button"
                  onClick={() => {
                    setMode("existing");
                    setPendingNewCustomer(null);
                  }}
                  className={`flex-1 py-2 text-sm ${
                    mode === "existing" ? "bg-blue-600 text-white" : ""
                  }`}
                >
                  Existing Borrower
                </button>
                {canCreateCustomer && (
                  <button
                    type="button"
                    onClick={() => setMode("new")}
                    className={`flex-1 py-2 text-sm ${
                      mode === "new" ? "bg-blue-600 text-white" : ""
                    }`}
                  >
                    New Borrower
                  </button>
                )}
              </div>
            )}

            {mode === "existing" && (
              <div>
                <label className="text-sm font-medium">Borrower</label>
                {preselectedCustomerId ? (
                  <div className="mt-1 rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                    {customers.find((c) => c.id === preselectedCustomerId)
                      ?.full_name ?? `Customer #${preselectedCustomerId}`}
                  </div>
                ) : (
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                    className={inputCls("customer_id")}
                  >
                    <option value={0}>Select borrower...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}
                      </option>
                    ))}
                  </select>
                )}
                {(selectedCustomerId > 0 || preselectedCustomerId) && (
                  <div className="mt-3">
                    {scoreLoading ? (
                      <p className="text-sm text-slate-500">Loading credit score…</p>
                    ) : (
                      <CreditScoreCard
                        score={creditScore}
                        compact
                        refreshing={scoreRefreshing}
                        onRefresh={async () => {
                          const cid =
                            selectedCustomerId || preselectedCustomerId || 0;
                          if (!cid) return;
                          try {
                            setScoreRefreshing(true);
                            setCreditScore(await refreshCustomerCreditScore(cid));
                          } catch {
                            /* keep prior */
                          } finally {
                            setScoreRefreshing(false);
                          }
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {mode === "new" && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 dark:border-slate-600 dark:bg-slate-700/40">
                {pendingNewCustomer ? (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        {pendingNewCustomer.full_name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {pendingNewCustomer.phone} · KYC ready
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-blue-600"
                      onClick={() => setPendingNewCustomer(null)}
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <BorrowerKycForm
                    embedded
                    loading={false}
                    submitLabel="Use for this loan"
                    onCancel={onClose}
                    onSubmit={(data) => setPendingNewCustomer(data)}
                  />
                )}
                {errors.new_customer && (
                  <p className="mt-2 text-xs text-red-600">{errors.new_customer}</p>
                )}
              </div>
            )}

            {(mode === "existing" || pendingNewCustomer) && (
              <>
                <div>
                  {agents.length > 0 && (
                    <div className="mb-3">
                      <label className="text-sm font-medium">
                        Collection agent *
                      </label>
                      <select
                        className={inputCls("collection_agent_id")}
                        value={collectionAgentId || ""}
                        onChange={(e) =>
                          setCollectionAgentId(Number(e.target.value) || 0)
                        }
                      >
                        <option value="">Select agent</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.full_name}
                            {a.assigned_area ? ` · ${a.assigned_area}` : ""}
                          </option>
                        ))}
                      </select>
                      {errors.collection_agent_id && (
                        <p className="mt-1 text-xs text-red-600">
                          {errors.collection_agent_id}
                        </p>
                      )}
                    </div>
                  )}

                  <label className="text-sm font-medium">
                    Collection frequency *
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) =>
                      setFrequency(e.target.value as CollectionFrequency)
                    }
                    className={inputCls("frequency")}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {FREQUENCY_LABELS[f]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Principal (₹) *</label>
                    <input
                      type="number"
                      value={principalAmount}
                      onChange={(e) => setPrincipalAmount(e.target.value)}
                      className={inputCls("principal_amount")}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Interest % *</label>
                    <input
                      type="number"
                      value={interestPercent}
                      onChange={(e) => setInterestPercent(e.target.value)}
                      className={inputCls("interest_percent")}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      {FREQUENCY_COUNT_LABELS[frequency]} *
                    </label>
                    <input
                      type="number"
                      value={installmentCount}
                      onChange={(e) => setInstallmentCount(e.target.value)}
                      className={inputCls("installment_count")}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Issue date</label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className={inputCls("issue_date")}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium">
                      First collection date *
                    </label>
                    <input
                      type="date"
                      value={dueStartDate}
                      min={issueDate}
                      onChange={(e) => setDueStartDate(e.target.value)}
                      className={inputCls("due_start_date")}
                    />
                  </div>
                </div>

                {errors.capital && (
                  <p className="text-xs text-red-600">{errors.capital}</p>
                )}

                {terms && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-600 dark:bg-slate-700/50">
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      Auto-calculated
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <span>Final due date</span>
                      <span className="font-medium">{dueDate}</span>
                      <span>{installmentAmountLabel(frequency)}</span>
                      <span className="font-medium">
                        {fmt(terms.installmentAmount)}
                      </span>
                      <span>Principal / installment</span>
                      <span>{fmt(terms.installmentPrincipal)}</span>
                      <span>Profit / installment</span>
                      <span className="text-green-700">
                        {fmt(terms.installmentProfit)}
                      </span>
                      <span>Total repayment</span>
                      <span>{fmt(terms.totalRepayment)}</span>
                      <span>Expected profit</span>
                      <span className="text-green-700">
                        {fmt(terms.totalProfit)}
                      </span>
                      <span>Installments</span>
                      <span>{count}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {primaryLabel}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border px-6 py-2"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
