import { useEffect, useMemo, useState } from "react";

import MainLayout from "../../components/layout/MainLayout";
import { PageError, PageLoading } from "../../components/common/PageStates";
import StepIndicator from "../../components/common/StepIndicator";
import { useToast } from "../../context/ToastContext";
import { useNavBadges } from "../../context/NavBadgesContext";
import {
  getAgentDashboard,
  getMyLedger,
  getMySettlements,
  getMyWallet,
  submitSettlement,
} from "../../services/agentWalletService";
import type {
  AgentLedgerEntry,
  AgentSettlement,
  SettlementDeliveryMethod,
} from "../../types/agentWallet";
import { fmt } from "../../utils/fmt";

function num(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function deliveryLabel(method: string) {
  switch (method) {
    case "UPI":
      return "UPI";
    case "BANK":
      return "Bank transfer";
    case "MIXED":
      return "Mixed";
    default:
      return "Cash";
  }
}

export default function AgentSettlementPage() {
  const toast = useToast();
  const { refresh: refreshBadges } = useNavBadges();
  const [wallet, setWallet] = useState<Awaited<ReturnType<typeof getMyWallet>> | null>(null);
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof getAgentDashboard>> | null>(null);
  const [ledger, setLedger] = useState<AgentLedgerEntry[]>([]);
  const [settlements, setSettlements] = useState<AgentSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formStep, setFormStep] = useState(1);

  const [cashAmount, setCashAmount] = useState("");
  const [upiAmount, setUpiAmount] = useState("");
  const [otherAmount, setOtherAmount] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<SettlementDeliveryMethod>("CASH");
  const [deliveryCash, setDeliveryCash] = useState("");
  const [deliveryUpi, setDeliveryUpi] = useState("");
  const [deliveryOther, setDeliveryOther] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [transferDate, setTransferDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [proofNotes, setProofNotes] = useState("");
  const [reconciliationNote, setReconciliationNote] = useState("");

  const clearedTotal = useMemo(
    () => num(cashAmount) + num(upiAmount) + num(otherAmount),
    [cashAmount, upiAmount, otherAmount]
  );

  const deliveryTotal = useMemo(
    () => num(deliveryCash) + num(deliveryUpi) + num(deliveryOther),
    [deliveryCash, deliveryUpi, deliveryOther]
  );

  const needsUpiReference =
    deliveryMethod === "UPI" ||
    deliveryMethod === "BANK" ||
    (deliveryMethod === "MIXED" && num(deliveryUpi) > 0);

  function resetForm(w: Awaited<ReturnType<typeof getMyWallet>>) {
    setCashAmount(w.cash_balance);
    setUpiAmount(w.upi_balance);
    setOtherAmount(w.other_balance);
    setDeliveryMethod("CASH");
    setDeliveryCash("");
    setDeliveryUpi("");
    setDeliveryOther("");
    setTransferReference("");
    setTransferDate(new Date().toISOString().split("T")[0]);
    setProofNotes("");
    setReconciliationNote("");
    setFormStep(1);
    setFormError("");
  }

  function syncDeliveryForMethod(method: SettlementDeliveryMethod, total: number) {
    if (method === "CASH") {
      setDeliveryCash(total > 0 ? String(total) : "");
      setDeliveryUpi("");
      setDeliveryOther("");
    } else if (method === "UPI") {
      setDeliveryCash("");
      setDeliveryUpi(total > 0 ? String(total) : "");
      setDeliveryOther("");
    } else if (method === "BANK") {
      setDeliveryCash("");
      setDeliveryUpi("");
      setDeliveryOther(total > 0 ? String(total) : "");
    }
  }

  function handleDeliveryMethodChange(method: SettlementDeliveryMethod) {
    setDeliveryMethod(method);
    if (method !== "MIXED") {
      syncDeliveryForMethod(method, clearedTotal);
    }
  }

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [w, d, l, s] = await Promise.all([
        getMyWallet(),
        getAgentDashboard(),
        getMyLedger(),
        getMySettlements(),
      ]);
      setWallet(w);
      setDashboard(d);
      setLedger(l);
      setSettlements(s);
      resetForm(w);
    } catch {
      setError("Failed to load settlement data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (deliveryMethod !== "MIXED") {
      syncDeliveryForMethod(deliveryMethod, clearedTotal);
    }
  }, [clearedTotal, deliveryMethod]);

  function validateStep1(): string | null {
    if (clearedTotal <= 0) return "Enter at least one amount to clear from your wallet.";
    if (num(cashAmount) > num(wallet?.cash_balance ?? "0"))
      return "Cash cleared exceeds your cash balance.";
    if (num(upiAmount) > num(wallet?.upi_balance ?? "0"))
      return "UPI cleared exceeds your UPI balance.";
    if (num(otherAmount) > num(wallet?.other_balance ?? "0"))
      return "Other cleared exceeds your other balance.";
    return null;
  }

  function validateStep2(): string | null {
    if (deliveryMethod === "MIXED" && deliveryTotal !== clearedTotal) {
      return "Delivery amounts must equal the total being cleared.";
    }
    return null;
  }

  function validateStep3(): string | null {
    if (needsUpiReference && !transferReference.trim()) {
      return deliveryMethod === "BANK"
        ? "Bank transfer reference is required."
        : "UPI reference is required when delivery includes UPI.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const step1 = validateStep1();
    const step2 = validateStep2();
    const step3 = validateStep3();
    if (step1 || step2 || step3) {
      setFormError(step1 || step2 || step3 || "Invalid settlement.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      await submitSettlement({
        cash_amount: cashAmount || "0",
        upi_amount: upiAmount || "0",
        other_amount: otherAmount || "0",
        delivery_method: deliveryMethod,
        delivery_cash_amount: deliveryCash || "0",
        delivery_upi_amount: deliveryUpi || "0",
        delivery_other_amount: deliveryOther || "0",
        transfer_reference: transferReference || undefined,
        transfer_date: transferDate || undefined,
        proof_notes: proofNotes || undefined,
        reconciliation_note: reconciliationNote || undefined,
      });
      setShowForm(false);
      toast.success("Settlement submitted. Owner will review it in Agent Settlements.");
      await load();
      refreshBadges();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setFormError(typeof detail === "string" ? detail : "Settlement failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <PageLoading message="Loading..." />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <PageError message={error} onRetry={load} />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">My Settlement</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Clear wallet balances and record how the owner received payment
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (wallet) resetForm(wallet);
              setShowForm(true);
            }}
            disabled={
              Number(wallet?.total_balance) <= 0 || wallet?.has_pending_settlement
            }
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            Submit Settlement
          </button>
        </div>

        {wallet?.has_pending_settlement && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Settlement of {fmt(wallet.pending_settlement_total ?? "0")} is pending owner
            approval. You cannot submit another until it is reviewed.
          </div>
        )}

        {dashboard && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="surface-card p-4">
              <p className="text-sm text-gray-500 dark:text-slate-400">Expected Today</p>
              <p className="text-xl font-bold">{fmt(dashboard.expected_today)}</p>
            </div>
            <div className="surface-card p-4">
              <p className="text-sm text-gray-500 dark:text-slate-400">Collected Today</p>
              <p className="text-xl font-bold text-green-700">
                {fmt(dashboard.collected_today)}
              </p>
            </div>
            <div className="surface-card p-4">
              <p className="text-sm text-gray-500 dark:text-slate-400">Pending Today</p>
              <p className="text-xl font-bold text-amber-600">
                {fmt(dashboard.pending_today)}
              </p>
            </div>
            <div className="surface-card p-4">
              <p className="text-sm text-gray-500 dark:text-slate-400">Unsettled Total</p>
              <p className="text-xl font-bold">{fmt(wallet?.total_balance)}</p>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="surface-card p-5">
            <p className="text-sm text-gray-500 dark:text-slate-400">Cash Balance</p>
            <p className="text-2xl font-bold">{fmt(wallet?.cash_balance)}</p>
          </div>
          <div className="surface-card p-5">
            <p className="text-sm text-gray-500 dark:text-slate-400">UPI Balance</p>
            <p className="text-2xl font-bold">{fmt(wallet?.upi_balance)}</p>
          </div>
          <div className="surface-card p-5">
            <p className="text-sm text-gray-500 dark:text-slate-400">Other Balance</p>
            <p className="text-2xl font-bold">{fmt(wallet?.other_balance)}</p>
          </div>
        </div>

        {dashboard && !dashboard.is_balanced && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Reconciliation difference: {fmt(dashboard.reconciliation_difference)} —
            provide a note when settling if amounts do not match.
          </div>
        )}

        {showForm && (
          <div className="surface-card p-6">
            <h2 className="section-title">Create Settlement</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Step {formStep} of 3 —{" "}
              {formStep === 1
                ? "What to clear from wallet"
                : formStep === 2
                  ? "How owner received payment"
                  : "Details & review"}
            </p>
            <div className="mt-4">
              <StepIndicator step={formStep} />
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {formStep === 1 && (
                <>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    These amounts are debited from your wallet channels when the owner
                    approves. You can clear cash even if you pay the owner via UPI.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!wallet) return;
                        setCashAmount(wallet.cash_balance);
                        setUpiAmount(wallet.upi_balance);
                        setOtherAmount(wallet.other_balance);
                      }}
                      className="rounded border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      Settle all balances
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="text-sm font-medium">Clear from Cash</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        className="mt-1 w-full rounded border px-3 py-2 text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                        Available: {fmt(wallet?.cash_balance)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Clear from UPI</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={upiAmount}
                        onChange={(e) => setUpiAmount(e.target.value)}
                        className="mt-1 w-full rounded border px-3 py-2 text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                        Available: {fmt(wallet?.upi_balance)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Clear from Other</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={otherAmount}
                        onChange={(e) => setOtherAmount(e.target.value)}
                        className="mt-1 w-full rounded border px-3 py-2 text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                        Available: {fmt(wallet?.other_balance)}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-medium">
                    Total to clear: {fmt(clearedTotal)}
                  </p>
                </>
              )}

              {formStep === 2 && (
                <>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    How did you actually deliver {fmt(clearedTotal)} to the owner?
                  </p>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {(["CASH", "UPI", "BANK", "MIXED"] as SettlementDeliveryMethod[]).map(
                      (m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleDeliveryMethodChange(m)}
                          className={`rounded-lg border px-3 py-2 text-sm ${
                            deliveryMethod === m
                              ? "border-blue-600 bg-blue-50 font-medium text-blue-800"
                              : "hover:bg-gray-50 dark:hover:bg-slate-700"
                          }`}
                        >
                          {deliveryLabel(m)}
                        </button>
                      )
                    )}
                  </div>

                  {deliveryMethod === "MIXED" ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <label className="text-sm font-medium">Received as Cash</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={deliveryCash}
                          onChange={(e) => setDeliveryCash(e.target.value)}
                          className="mt-1 w-full rounded border px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Received as UPI</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={deliveryUpi}
                          onChange={(e) => setDeliveryUpi(e.target.value)}
                          className="mt-1 w-full rounded border px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Received as Bank/Other</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={deliveryOther}
                          onChange={(e) => setDeliveryOther(e.target.value)}
                          className="mt-1 w-full rounded border px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-slate-300">
                      Owner receives {fmt(clearedTotal)} via {deliveryLabel(deliveryMethod)}.
                    </p>
                  )}

                  {deliveryMethod === "MIXED" && deliveryTotal !== clearedTotal && (
                    <p className="text-sm text-amber-700">
                      Delivery total {fmt(deliveryTotal)} must equal cleared total{" "}
                      {fmt(clearedTotal)}.
                    </p>
                  )}
                </>
              )}

              {formStep === 3 && (
                <>
                  <div className="rounded-lg bg-slate-50 p-4 text-sm">
                    <p className="font-medium">Summary</p>
                    <p className="mt-2">
                      Clearing from wallet: Cash {fmt(cashAmount)}, UPI {fmt(upiAmount)},
                      Other {fmt(otherAmount)} — total {fmt(clearedTotal)}
                    </p>
                    <p className="mt-1">
                      Received via {deliveryLabel(deliveryMethod)}: Cash{" "}
                      {fmt(deliveryCash || (deliveryMethod === "CASH" ? clearedTotal : 0))},
                      UPI{" "}
                      {fmt(deliveryUpi || (deliveryMethod === "UPI" ? clearedTotal : 0))},
                      Bank/Other{" "}
                      {fmt(
                        deliveryOther || (deliveryMethod === "BANK" ? clearedTotal : 0)
                      )}
                    </p>
                  </div>

                  {needsUpiReference && (
                    <div>
                      <label className="text-sm font-medium">
                        {deliveryMethod === "BANK"
                          ? "Bank transfer reference *"
                          : "UPI reference *"}
                      </label>
                      <input
                        placeholder="Transaction ID / UPI ref"
                        value={transferReference}
                        onChange={(e) => setTransferReference(e.target.value)}
                        required={needsUpiReference}
                        className="mt-1 w-full rounded border px-3 py-2 text-sm"
                      />
                    </div>
                  )}

                  {!needsUpiReference && (
                    <input
                      placeholder="Reference (optional)"
                      value={transferReference}
                      onChange={(e) => setTransferReference(e.target.value)}
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  )}

                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Proof notes (screenshot description)"
                    value={proofNotes}
                    onChange={(e) => setProofNotes(e.target.value)}
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Reconciliation note (if difference)"
                    value={reconciliationNote}
                    onChange={(e) => setReconciliationNote(e.target.value)}
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                </>
              )}

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex gap-3">
                {formStep > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormError("");
                      setFormStep((s) => s - 1);
                    }}
                    className="rounded-lg border px-4 py-2 text-sm"
                  >
                    Back
                  </button>
                )}
                {formStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const err = formStep === 1 ? validateStep1() : validateStep2();
                      if (err) {
                        setFormError(err);
                        return;
                      }
                      setFormError("");
                      setFormStep((s) => s + 1);
                    }}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                  >
                    {saving ? "Submitting..." : "Submit for Approval"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="table-shell">
          <div className="border-b px-6 py-4">
            <h2 className="font-semibold">My Ledger</h2>
          </div>
          <table className="min-w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-right">Credit</th>
                <th className="px-4 py-3 text-right">Debit</th>
                <th className="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ledger.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">{e.entry_type}</td>
                  <td className="px-4 py-3">{e.channel}</td>
                  <td className="px-4 py-3 text-right text-green-700">
                    {Number(e.credit_amount) > 0 ? fmt(e.credit_amount) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-red-600">
                    {Number(e.debit_amount) > 0 ? fmt(e.debit_amount) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {fmt(e.balance_after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-shell">
          <div className="border-b px-6 py-4">
            <h2 className="font-semibold">Settlement History</h2>
          </div>
          <table className="min-w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3 text-left">Submitted</th>
                <th className="px-4 py-3 text-right">Cleared</th>
                <th className="px-4 py-3 text-left">Received via</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {settlements.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    {new Date(s.submitted_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {fmt(s.total_amount)}
                    <span className="block text-xs text-gray-500 dark:text-slate-400">
                      C {fmt(s.cash_amount)} / U {fmt(s.upi_amount)} / O{" "}
                      {fmt(s.other_amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {deliveryLabel(s.delivery_method)}
                    <span className="block text-xs text-gray-500 dark:text-slate-400">
                      C {fmt(s.delivery_cash_amount)} / U {fmt(s.delivery_upi_amount)} / B{" "}
                      {fmt(s.delivery_other_amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{s.transfer_reference || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
