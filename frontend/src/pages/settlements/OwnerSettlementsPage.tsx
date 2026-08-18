import { useEffect, useState } from "react";

import MainLayout from "../../components/layout/MainLayout";
import { PageError, PageLoading } from "../../components/common/PageStates";
import ConfirmModal from "../../components/common/ConfirmModal";
import PromptModal from "../../components/common/PromptModal";
import PositiveEmptyState from "../../components/common/PositiveEmptyState";
import StatusChip from "../../components/common/StatusChip";
import { useToast } from "../../context/ToastContext";
import { useNavBadges } from "../../context/NavBadgesContext";
import {
  approveSettlement,
  getAllSettlements,
  getPendingSettlements,
  listAgentWallets,
  rejectSettlement,
} from "../../services/agentWalletService";
import type { AgentSettlement, AgentWalletBalance } from "../../types/agentWallet";
import { fmt } from "../../utils/fmt";

function statusDot(status?: string) {
  if (status === "green") return "🟢";
  if (status === "yellow") return "🟡";
  if (status === "red") return "🔴";
  return "⚪";
}

function deliveryLabel(method: string) {
  switch (method) {
    case "UPI":
      return "UPI";
    case "BANK":
      return "Bank";
    case "MIXED":
      return "Mixed";
    default:
      return "Cash";
  }
}

export default function OwnerSettlementsPage() {
  const toast = useToast();
  const { refresh: refreshBadges } = useNavBadges();
  const [agents, setAgents] = useState<AgentWalletBalance[]>([]);
  const [pending, setPending] = useState<AgentSettlement[]>([]);
  const [history, setHistory] = useState<AgentSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [agentList, pendingList, allList] = await Promise.all([
        listAgentWallets(),
        getPendingSettlements(),
        getAllSettlements(),
      ]);
      setAgents(agentList);
      setPending(pendingList);
      setHistory(allList.filter((s) => s.status !== "PENDING_VERIFICATION"));
    } catch {
      setError("Failed to load settlements. Owner access required.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function confirmApprove() {
    if (!approveId) return;
    setActionId(approveId);
    try {
      await approveSettlement(approveId);
      toast.success("Settlement approved. Agent wallet updated.");
      await load();
      refreshBadges();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Approval failed.");
    } finally {
      setActionId(null);
      setApproveId(null);
    }
  }

  async function confirmReject(reason: string) {
    if (!rejectId) return;
    setActionId(rejectId);
    try {
      await rejectSettlement(rejectId, reason);
      toast.info("Settlement rejected. Agent has been notified.");
      await load();
      refreshBadges();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Rejection failed.");
    } finally {
      setActionId(null);
      setRejectId(null);
    }
  }

  const pendingSettlement = pending.find((s) => s.id === approveId);

  if (loading) {
    return (
      <MainLayout>
        <PageLoading message="Loading settlements..." />
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Agent Settlements</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Review agent balances and approve settlements
          </p>
        </div>

        <div className="table-shell">
          <div className="border-b px-6 py-4">
            <h2 className="font-semibold">Collection Agents</h2>
          </div>
          <table className="min-w-full text-sm">
            <thead className="table-head">
              <tr>
                  <th className="px-4 py-3 text-left">Agent</th>
                <th className="px-4 py-3 text-left">Area</th>
                <th className="px-4 py-3 text-right">Today</th>
                <th className="px-4 py-3 text-right">Unsettled</th>
                <th className="px-4 py-3 text-right">Pending</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {agents.map((a) => (
                <tr key={a.agent_id}>
                  <td className="px-4 py-3 table-cell-strong">{a.agent_name}</td>
                  <td className="px-4 py-3 table-cell">{a.assigned_area || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {fmt(a.today_collected ?? "0")}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {fmt(a.unsettled_balance ?? a.total_balance)}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-700">
                    {a.has_pending_settlement
                      ? fmt(a.pending_settlement_total ?? "0")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {statusDot(a.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-shell">
          <div className="border-b px-6 py-4">
            <h2 className="font-semibold">Pending Settlements</h2>
          </div>
          {!pending.length ? (
            <PositiveEmptyState
              title="All clear"
              message="No settlements waiting for your approval. Agents can submit from My Settlement."
            />
          ) : (
            <table className="min-w-full text-sm">
              <thead className="table-head">
                <tr>
                    <th className="px-4 py-3 text-left">Agent</th>
                  <th className="px-4 py-3 text-left">Clearing from</th>
                  <th className="px-4 py-3 text-left">Received via</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {pending.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 table-cell-strong">{s.agent_name}</td>
                    <td className="px-4 py-3 text-sm">
                      Cash {fmt(s.cash_amount)}
                      <br />
                      UPI {fmt(s.upi_amount)}
                      <br />
                      Other {fmt(s.other_amount)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium">{deliveryLabel(s.delivery_method)}</span>
                      <br />
                      Cash {fmt(s.delivery_cash_amount)}
                      <br />
                      UPI {fmt(s.delivery_upi_amount)}
                      <br />
                      Bank {fmt(s.delivery_other_amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {fmt(s.total_amount)}
                    </td>
                    <td className="px-4 py-3">{s.transfer_reference || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={actionId === s.id}
                        onClick={() => setApproveId(s.id)}
                        className="mr-2 text-green-600 hover:underline disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actionId === s.id}
                        onClick={() => setRejectId(s.id)}
                        className="text-red-600 hover:underline disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="table-shell">
          <div className="border-b px-6 py-4">
            <h2 className="font-semibold">Settlement History</h2>
          </div>
          <table className="min-w-full text-sm">
            <thead className="table-head">
              <tr>
                  <th className="px-4 py-3 text-left">Agent</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Delivery</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {history.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 table-cell">{s.agent_name}</td>
                  <td className="px-4 py-3 text-right">{fmt(s.total_amount)}</td>
                  <td className="px-4 py-3">{deliveryLabel(s.delivery_method)}</td>
                  <td className="px-4 py-3"><StatusChip status={s.status} /></td>
                  <td className="px-4 py-3">
                    {new Date(s.submitted_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {approveId && (
        <ConfirmModal
          title="Approve settlement?"
          message={
            pendingSettlement
              ? `Approve ${pendingSettlement.agent_name}'s settlement of ${fmt(pendingSettlement.total_amount)}? Agent wallet will be debited.`
              : "Approve this settlement?"
          }
          confirmLabel="Approve"
          confirmClass="bg-green-600 hover:bg-green-700"
          loading={actionId === approveId}
          onConfirm={confirmApprove}
          onCancel={() => setApproveId(null)}
        />
      )}

      {rejectId && (
        <PromptModal
          title="Reject settlement"
          message="Provide a reason for the agent."
          label="Rejection reason"
          confirmLabel="Reject"
          loading={actionId === rejectId}
          onConfirm={confirmReject}
          onCancel={() => setRejectId(null)}
        />
      )}
    </MainLayout>
  );
}
