import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import MainLayout from "../../components/layout/MainLayout";
import CreditScoreCard from "../../components/credit/CreditScoreCard";
import CreditScoreGauge from "../../components/credit/CreditScoreGauge";
import { getCustomerLedger } from "../../services/customerService";
import { refreshCustomerCreditScore } from "../../services/creditScoreService";
import type { CustomerLedger } from "../../types/ledger";
import type { CreditScore } from "../../types/creditScore";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export default function CustomerScorePage() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("customers.edit");

  const [ledger, setLedger] = useState<CustomerLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!customerId) return;
    try {
      setLoading(true);
      setLedger(await getCustomerLedger(Number(customerId)));
    } catch {
      setLedger(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [customerId]);

  async function handleRefresh() {
    if (!customerId) return;
    try {
      setRefreshing(true);
      await refreshCustomerCreditScore(Number(customerId));
      await load();
      toast.success("Credit score refreshed.");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Failed to refresh score.");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 text-slate-500">Loading score…</div>
      </MainLayout>
    );
  }

  if (!ledger) {
    return (
      <MainLayout>
        <div className="space-y-3 p-6">
          <p className="text-slate-500">Customer not found.</p>
          <button type="button" className="text-blue-600" onClick={() => navigate("/customers")}>
            ← Back
          </button>
        </div>
      </MainLayout>
    );
  }

  const score = ledger.credit_score
    ? ({
        ...ledger.credit_score,
        reasons: ledger.credit_score.reasons || [],
      } as CreditScore)
    : null;

  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          to={`/customers/${customerId}/ledger?tab=overview`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to {ledger.customer.full_name}
        </Link>
        <h1 className="page-title">Credit score details</h1>
        <p className="page-subtitle">
          {ledger.customer.display_code || `#${ledger.customer.id}`} · advisory only
        </p>
        <CreditScoreGauge score={score} size={280} />
        <CreditScoreCard
          score={score}
          onRefresh={canEdit ? handleRefresh : undefined}
          refreshing={refreshing}
        />
      </div>
    </MainLayout>
  );
}
