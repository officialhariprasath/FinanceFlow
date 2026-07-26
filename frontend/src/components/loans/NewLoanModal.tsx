import { useEffect, useState } from "react";
import { createLoan } from "../../services/loanService";
import { createCustomer } from "../../services/customerService";
import api from "../../api/axios";
import type { LoanCreate } from "../../types/loan";
import type { CustomerCreate } from "../../types/customer";

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

const EMPTY_LOAN: Omit<LoanCreate, "customer_id"> = {
  principal_amount: "",
  interest_method: "PERCENTAGE",
  interest_rate: "",
  issue_date: new Date().toISOString().split("T")[0],
  due_date: "",
};

const EMPTY_NEW_CUSTOMER: CustomerCreate = {
  full_name: "",
  phone: "",
  address: "",
};

export default function NewLoanModal({
  onClose,
  onSuccess,
  preselectedCustomerId,
}: Props) {
  const [mode, setMode] = useState<CustomerMode>(
    preselectedCustomerId ? "existing" : "existing"
  );

  // Existing customer
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(
    preselectedCustomerId ?? 0
  );

  // New customer fields
  const [newCustomer, setNewCustomer] =
    useState<CustomerCreate>(EMPTY_NEW_CUSTOMER);

  // Loan fields
  const [loan, setLoan] =
    useState<Omit<LoanCreate, "customer_id">>(EMPTY_LOAN);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    api
      .get<CustomerOption[]>("/customers/names")
      .then((r) => setCustomers(r.data))
      .catch(() => {});
  }, []);

  function validate(): boolean {
    const e: Record<string, string> = {};

    if (mode === "existing") {
      if (!selectedCustomerId) e.customer_id = "Select a customer.";
    } else {
      if (!newCustomer.full_name.trim())
        e.new_full_name = "Full name is required.";
      else if (newCustomer.full_name.trim().length < 2)
        e.new_full_name = "Full name must be at least 2 characters.";

      if (!newCustomer.phone.trim())
        e.new_phone = "Mobile number is required.";
      else if (!/^\d{10}$/.test(newCustomer.phone.trim()))
        e.new_phone = "Enter a valid 10-digit mobile number.";
    }

    if (!loan.principal_amount || Number(loan.principal_amount) <= 0)
      e.principal_amount = "Enter a valid principal amount.";
    if (!loan.interest_rate || Number(loan.interest_rate) <= 0)
      e.interest_rate = "Enter a valid interest rate.";
    if (!loan.issue_date) e.issue_date = "Issue date is required.";
    if (!loan.due_date) e.due_date = "Due date is required.";
    if (loan.issue_date && loan.due_date && loan.due_date <= loan.issue_date)
      e.due_date = "Due date must be after issue date.";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSaving(true);
      setApiError("");

      let customerId = selectedCustomerId;

      if (mode === "new") {
        const created = await createCustomer({
          full_name: newCustomer.full_name.trim(),
          phone: newCustomer.phone.trim(),
          address: newCustomer.address.trim(),
        });
        customerId = created.id;
      }

      await createLoan({ ...loan, customer_id: customerId });
      onSuccess();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setApiError(
        typeof detail === "string" ? detail : "Failed to create loan."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (key: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      errors[key] ? "border-red-400" : "border-slate-300"
    }`;

  function fieldErr(key: string) {
    return errors[key] ? (
      <p className="mt-1 text-xs text-red-600">{errors[key]}</p>
    ) : null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-800">New Loan</h2>
        </div>

        {/* Scrollable body */}
        <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
          {apiError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Customer mode toggle — only shown when not preselected */}
            {!preselectedCustomerId && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Customer
                </label>
                <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMode("existing")}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      mode === "existing"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Existing Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("new")}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      mode === "new"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    New Customer
                  </button>
                </div>
              </div>
            )}

            {/* Existing customer dropdown */}
            {mode === "existing" && (
              <div>
                {!preselectedCustomerId && (
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Select Customer
                  </label>
                )}
                {preselectedCustomerId ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {customers.find((c) => c.id === preselectedCustomerId)
                      ?.full_name ?? `Customer #${preselectedCustomerId}`}
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) =>
                        setSelectedCustomerId(Number(e.target.value))
                      }
                      className={inputCls("customer_id")}
                    >
                      <option value={0}>Select customer...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name}
                        </option>
                      ))}
                    </select>
                    {fieldErr("customer_id")}
                  </>
                )}
              </div>
            )}

            {/* New customer fields */}
            {mode === "new" && (
              <div className="space-y-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  New Customer Details
                </p>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCustomer.full_name}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        full_name: e.target.value,
                      })
                    }
                    placeholder="Enter customer full name"
                    className={inputCls("new_full_name")}
                  />
                  {fieldErr("new_full_name")}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCustomer.phone}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        phone: e.target.value,
                      })
                    }
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    className={inputCls("new_phone")}
                  />
                  {fieldErr("new_phone")}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Address
                  </label>
                  <input
                    type="text"
                    value={newCustomer.address}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        address: e.target.value,
                      })
                    }
                    placeholder="Address (optional)"
                    className={inputCls("new_address")}
                  />
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-slate-200 pt-1">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Loan Details
              </p>
            </div>

            {/* Principal */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Principal Amount (₹)
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={loan.principal_amount}
                onChange={(e) =>
                  setLoan({ ...loan, principal_amount: e.target.value })
                }
                placeholder="e.g. 50000"
                className={inputCls("principal_amount")}
              />
              {fieldErr("principal_amount")}
            </div>

            {/* Interest method */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Interest Method
              </label>
              <select
                value={loan.interest_method}
                onChange={(e) =>
                  setLoan({ ...loan, interest_method: e.target.value })
                }
                className={inputCls("interest_method")}
              >
                <option value="PERCENTAGE">Percentage (% per month)</option>
                <option value="RUPEES_PER_100">
                  Rupees per ₹100 per month
                </option>
              </select>
            </div>

            {/* Interest rate */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {loan.interest_method === "PERCENTAGE"
                  ? "Interest Rate (% per month)"
                  : "Interest Rate (₹ per ₹100)"}
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={loan.interest_rate}
                onChange={(e) =>
                  setLoan({ ...loan, interest_rate: e.target.value })
                }
                placeholder={
                  loan.interest_method === "PERCENTAGE" ? "e.g. 2" : "e.g. 3"
                }
                className={inputCls("interest_rate")}
              />
              {fieldErr("interest_rate")}
            </div>

            {/* Issue date */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Issue Date
              </label>
              <input
                type="date"
                value={loan.issue_date}
                onChange={(e) =>
                  setLoan({ ...loan, issue_date: e.target.value })
                }
                className={inputCls("issue_date")}
              />
              {fieldErr("issue_date")}
            </div>

            {/* Due date */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Due Date
              </label>
              <input
                type="date"
                value={loan.due_date}
                onChange={(e) =>
                  setLoan({ ...loan, due_date: e.target.value })
                }
                className={inputCls("due_date")}
              />
              {fieldErr("due_date")}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving
                  ? mode === "new"
                    ? "Creating customer & loan..."
                    : "Creating loan..."
                  : "Create Loan"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-6 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
