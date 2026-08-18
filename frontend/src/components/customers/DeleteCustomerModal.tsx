import type { Customer } from "../../types/customer";

type DeleteCustomerModalProps = {
  customer: Customer | null;
  hasActiveLoans: boolean;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function DeleteCustomerModal({
  customer,
  hasActiveLoans,
  loading,
  onConfirm,
  onCancel,
}: DeleteCustomerModalProps) {
  if (!customer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md surface-card p-6-xl">
        <h2 className="text-xl font-semibold text-slate-800">Delete Customer</h2>

        {hasActiveLoans && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="font-semibold text-amber-800">⚠ Warning: Active Loan Exists</p>
            <p className="mt-1 text-sm text-amber-700">
              This customer has an active loan. Deleting this customer will
              permanently delete the active loan and all associated payments
              and renewal records.
            </p>
          </div>
        )}

        <p className="mt-4 text-slate-600">
          Are you sure you want to delete{" "}
          <span className="font-semibold">{customer.full_name}</span>?
        </p>

        <p className="mt-2 text-sm text-red-600">This action cannot be undone.</p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border px-4 py-2 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Deleting..." : hasActiveLoans ? "Delete Anyway" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}