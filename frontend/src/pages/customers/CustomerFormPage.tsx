import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import MainLayout from "../../components/layout/MainLayout";
import BorrowerKycForm from "../../components/customers/BorrowerKycForm";
import {
  createCustomer,
  getCustomer,
  updateCustomer,
} from "../../services/customerService";
import type { Customer, CustomerCreate } from "../../types/customer";
import { useToast } from "../../context/ToastContext";

export default function CustomerFormPage() {
  const { customerId } = useParams();
  const isEdit = Boolean(customerId);
  const navigate = useNavigate();
  const toast = useToast();
  const [initial, setInitial] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!customerId) return;
    getCustomer(Number(customerId))
      .then(setInitial)
      .catch(() => setError("Failed to load customer."))
      .finally(() => setLoading(false));
  }, [customerId]);

  async function handleSubmit(data: CustomerCreate) {
    try {
      setSaving(true);
      setError("");
      if (isEdit && customerId) {
        await updateCustomer(Number(customerId), data);
        toast.success("Customer updated.");
        navigate(`/customers/${customerId}/ledger`);
      } else {
        const created = await createCustomer(data);
        toast.success("Customer added.");
        navigate(`/customers/${created.id}/ledger`);
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : isEdit
            ? "Failed to update customer."
            : "Failed to add customer."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl space-y-4">
        <button
          type="button"
          className="text-sm text-blue-600 hover:underline"
          onClick={() =>
            navigate(isEdit && customerId ? `/customers/${customerId}/ledger` : "/customers")
          }
        >
          ← Back
        </button>
        <h1 className="page-title">{isEdit ? "Edit customer" : "Add customer"}</h1>
        <p className="page-subtitle">
          Complete borrower KYC. Required fields follow Settings → Borrower form.
        </p>
        {error && (
          <div className="rounded-lg alert-error border p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading ? (
          <div className="surface-card p-8 text-center text-muted">Loading…</div>
        ) : (
          <BorrowerKycForm
            initialData={initial}
            loading={saving}
            onSubmit={handleSubmit}
            onCancel={() =>
              navigate(
                isEdit && customerId ? `/customers/${customerId}/ledger` : "/customers"
              )
            }
            submitLabel={isEdit ? "Save changes" : "Save borrower"}
          />
        )}
      </div>
    </MainLayout>
  );
}
