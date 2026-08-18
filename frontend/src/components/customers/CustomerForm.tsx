import { useEffect, useState } from "react";
import type { Customer, CustomerCreate } from "../../types/customer";

type CustomerFormProps = {
  initialData?: Customer | null;
  loading: boolean;
  onSubmit: (data: CustomerCreate) => void;
  onCancel: () => void;
};

export default function CustomerForm({
  initialData,
  loading,
  onSubmit,
  onCancel,
}: CustomerFormProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [temporaryAddress, setTemporaryAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFullName(initialData.full_name);
      setPhone(initialData.phone);
      setPermanentAddress(initialData.permanent_address ?? "");
      setTemporaryAddress(initialData.temporary_address ?? "");
    } else {
      setFullName("");
      setPhone("");
      setPermanentAddress("");
      setTemporaryAddress("");
    }
    setErrors({});
  }, [initialData]);

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!fullName.trim()) {
      next.fullName = "Full name is required.";
    } else if (fullName.trim().length < 2) {
      next.fullName = "Full name must be at least 2 characters.";
    }

    if (!phone.trim()) {
      next.phone = "Mobile number is required.";
    } else if (!/^\d{10}$/.test(phone.trim())) {
      next.phone = "Enter a valid 10-digit mobile number.";
    }

    if (!permanentAddress.trim()) {
      next.permanentAddress = "Permanent address is required.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      full_name: fullName.trim(),
      phone: phone.trim(),
      permanent_address: permanentAddress.trim(),
      temporary_address: temporaryAddress.trim() || undefined,
    });
  }

  return (
    <div className="surface-card p-6">
      <h2 className="mb-5 text-xl font-semibold text-slate-800 dark:text-slate-100">
        {initialData ? "Edit Customer" : "Add New Customer"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label className="label-field">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={`input-field px-4 py-3 ${
              errors.fullName ? "input-field-error" : ""
            }`}
          />
          {errors.fullName && (
            <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>
          )}
        </div>

        <div>
          <label className="label-field">
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={10}
            className={`input-field px-4 py-3 ${
              errors.phone ? "input-field-error" : ""
            }`}
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
          )}
        </div>

        <div>
          <label className="label-field">
            Permanent Address <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={2}
            value={permanentAddress}
            onChange={(e) => setPermanentAddress(e.target.value)}
            className={`input-field px-4 py-3 ${
              errors.permanentAddress ? "input-field-error" : ""
            }`}
          />
          {errors.permanentAddress && (
            <p className="mt-1 text-sm text-red-600">{errors.permanentAddress}</p>
          )}
        </div>

        <div>
          <label className="label-field">
            Temporary / Current Address
          </label>
          <textarea
            rows={2}
            value={temporaryAddress}
            onChange={(e) => setTemporaryAddress(e.target.value)}
            placeholder="Optional — where borrower currently stays"
            className="input-field px-4 py-3"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Saving..." : initialData ? "Update Customer" : "Add Customer"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn-secondary px-6 py-3 font-medium"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
