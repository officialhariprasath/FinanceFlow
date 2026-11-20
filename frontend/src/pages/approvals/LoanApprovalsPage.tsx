import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import MainLayout from "../../components/layout/MainLayout";
import { PageError, PageLoading } from "../../components/common/PageStates";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useNavBadges } from "../../context/NavBadgesContext";
import {
  approveLoanRequest,
  getLoanApprovalFlags,
  listLoanApprovals,
  rejectLoanRequest,
} from "../../services/loanApprovalService";
import type { LoanApproval } from "../../types/loanApproval";
import { fmt } from "../../utils/fmt";
import { getCustomer } from "../../services/customerService";
import type { Customer } from "../../types/customer";

type Tab = "PENDING" | "APPROVED" | "REJECTED";

const REJECT_PRESETS = [
  "Incomplete KYC / documents",
  "Insufficient repayment capacity",
  "High existing exposure",
  "Area / collection risk",
  "Other",
];

export default function LoanApprovalsPage() {
  const toast = useToast();
  const { hasPermission, session } = useAuth();
  const { refresh } = useNavBadges();
  const canApprove =
    session?.is_owner || hasPermission("loans.approve");

  const [tab, setTab] = useState<Tab>("PENDING");
  const [rows, setRows] = useState<LoanApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<LoanApproval | null>(null);
  const [kyc, setKyc] = useState<Customer | null>(null);
  const [acting, setActing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectPreset, setRejectPreset] = useState(REJECT_PRESETS[0]);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await listLoanApprovals(tab);
      setRows(data);
    } catch {
      setError("Failed to load approval requests.");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getLoanApprovalFlags().catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) {
      setKyc(null);
      return;
    }
    getCustomer(selected.customer_id)
      .then(setKyc)
      .catch(() => setKyc(null));
  }, [selected]);

  async function handleApprove() {
    if (!selected || !canApprove) return;
    try {
      setActing(true);
      const updated = await approveLoanRequest(selected.id);
      toast.success(
        updated.created_loan_id
          ? `Approved — loan #${updated.created_loan_id} is active.`
          : "Loan approved."
      );
      setSelected(null);
      setRejectOpen(false);
      await load();
      refresh();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Approve failed.");
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    if (!selected || !canApprove) return;
    const reason =
      rejectPreset === "Other"
        ? rejectReason.trim()
        : rejectReason.trim()
          ? `${rejectPreset}: ${rejectReason.trim()}`
          : rejectPreset;
    if (reason.length < 3) {
      toast.error("Enter a rejection reason.");
      return;
    }
    try {
      setActing(true);
      await rejectLoanRequest(selected.id, reason);
      toast.success("Request rejected.");
      setSelected(null);
      setRejectOpen(false);
      setRejectReason("");
      await load();
      refresh();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Reject failed.");
    } finally {
      setActing(false);
    }
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            Loan approvals
          </h1>
          <p className="text-sm text-slate-500">
            Pending requests do not disburse capital or create schedules until approved.
          </p>
        </div>

        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
          {(["PENDING", "APPROVED", "REJECTED"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setSelected(null);
              }}
              className={`px-4 py-2 text-sm font-medium ${
                tab === t
                  ? "border-b-2 border-blue-600 text-blue-700"
                  : "text-slate-500"
              }`}
            >
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {loading && <PageLoading />}
        {error && <PageError message={error} onRetry={load} />}

        {!loading && !error && (
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="surface-card overflow-hidden lg:col-span-2">
              {rows.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No {tab.toLowerCase()} requests.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                  {rows.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(r);
                          setRejectOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                          selected?.id === r.id ? "bg-blue-50 dark:bg-slate-700" : ""
                        }`}
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-medium text-slate-800 dark:text-slate-100">
                            {r.customer_name || `Customer #${r.customer_id}`}
                          </span>
                          <span className="text-sm font-semibold">
                            {fmt(r.principal_amount)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {r.installment_count} × {r.collection_frequency.toLowerCase()}
                          {r.submitted_by_name ? ` · by ${r.submitted_by_name}` : ""}
                          {r.credit_score != null
                            ? ` · score ${r.credit_score}${r.credit_band ? ` (${r.credit_band})` : ""}`
                            : ""}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="surface-card p-5 lg:col-span-3">
              {!selected ? (
                <p className="text-sm text-slate-500">Select a request to review.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                        {selected.customer_name}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {selected.customer_display_code || ""} · {selected.customer_phone}
                      </p>
                    </div>
                    <span
                      className={`rounded px-2 py-1 text-xs font-semibold ${
                        selected.status === "PENDING"
                          ? "bg-amber-100 text-amber-800"
                          : selected.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {selected.status}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Principal</dt>
                      <dd className="font-medium">{fmt(selected.principal_amount)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Installments</dt>
                      <dd className="font-medium">
                        {selected.installment_count} ({selected.collection_frequency})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Issue / first due</dt>
                      <dd className="font-medium">
                        {selected.issue_date} → {selected.due_start_date}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Per installment</dt>
                      <dd className="font-medium">{fmt(selected.daily_payment)}</dd>
                    </div>
                    {selected.rejection_reason && (
                      <div className="col-span-2">
                        <dt className="text-slate-500">Rejection reason</dt>
                        <dd className="font-medium text-red-700">
                          {selected.rejection_reason}
                        </dd>
                      </div>
                    )}
                    {selected.created_loan_id && (
                      <div className="col-span-2">
                        <dt className="text-slate-500">Created loan</dt>
                        <dd>
                          <Link
                            className="font-medium text-blue-600"
                            to={`/loans/${selected.created_loan_id}`}
                          >
                            View loan #{selected.created_loan_id}
                          </Link>
                          {selected.reviewed_by_name
                            ? ` · approved by ${selected.reviewed_by_name}`
                            : ""}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {kyc && (
                    <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-600">
                      <p className="mb-2 font-medium text-slate-800 dark:text-slate-100">
                        Borrower KYC
                      </p>
                      <div className="grid gap-1 text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                        <span>ID: {kyc.id_type || "—"} {kyc.id_number || ""}</span>
                        <span>DOB: {kyc.date_of_birth || "—"} · {kyc.gender || "—"}</span>
                        <span>Occupation: {kyc.occupation || "—"}</span>
                        <span>Income: {kyc.monthly_income != null ? fmt(kyc.monthly_income) : "—"}</span>
                        <span>Guarantor: {kyc.guarantor_name || "—"} ({kyc.guarantor_phone || "—"})</span>
                        <span>Landmark: {kyc.area_landmark || "—"}</span>
                        <span className="sm:col-span-2">
                          Address: {kyc.permanent_address || "—"}
                        </span>
                      </div>
                    </div>
                  )}

                  {selected.status === "PENDING" && canApprove && (
                    <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                      <button
                        type="button"
                        disabled={acting}
                        onClick={handleApprove}
                        className="rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {acting ? "Working…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => setRejectOpen((v) => !v)}
                        className="rounded-lg border border-red-300 px-5 py-2.5 font-medium text-red-700 hover:bg-red-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {rejectOpen && selected.status === "PENDING" && (
                    <div className="space-y-3 rounded-lg border border-red-100 bg-red-50/50 p-4">
                      <label className="label-field">Reason</label>
                      <select
                        className="input-field px-3 py-2"
                        value={rejectPreset}
                        onChange={(e) => setRejectPreset(e.target.value)}
                      >
                        {REJECT_PRESETS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <textarea
                        className="input-field px-3 py-2"
                        rows={2}
                        placeholder={
                          rejectPreset === "Other"
                            ? "Describe why…"
                            : "Optional extra detail"
                        }
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={acting}
                        onClick={handleReject}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Confirm reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
