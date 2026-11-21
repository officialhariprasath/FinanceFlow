import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

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
  const [searchParams] = useSearchParams();
  const after = searchParams.get("after");
  const isEdit = Boolean(customerId);
  const navigate = useNavigate();
  const toast = useToast();
  const [initial, setInitial] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cancelTo =
    after === "new-loan"
      ? "/loans"
      : isEdit && customerId
        ? `/customers/${customerId}/ledger`
        : "/customers";

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
        if (after === "new-loan") {
          navigate(`/loans?newLoanCustomerId=${created.id}`);
        } else {
          navigate(`/customers/${created.id}/ledger`);
        }
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
      <div className="mx-auto w-full max-w-4xl space-y-4 px-1 sm:px-0">
        <button
          type="button"
          className="text-sm text-blue-600 hover:underline"
          onClick={() => navigate(cancelTo)}
        >
          ← Back
        </button>
        <div className="hidden md:block">
          <h1 className="page-title">
            {isEdit
              ? "Edit customer"
              : after === "new-loan"
                ? "New borrower"
                : "Add customer"}
          </h1>
          <p className="page-subtitle">
            {after === "new-loan"
              ? "Save the borrower, then continue to create their loan."
              : "Complete borrower KYC. Required fields follow Settings → Borrower form."}
          </p>
        </div>
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
            onCancel={() => navigate(cancelTo)}
            submitLabel={
              isEdit
                ? "Save changes"
                : after === "new-loan"
                  ? "Save & continue to loan"
                  : "Save borrower"
            }
          />
        )}
      </div>
    </MainLayout>
  );
}
