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
  const [address, setAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFullName(initialData.full_name);
      setPhone(initialData.phone);
      setAddress(initialData.address ?? "");
    } else {
      setFullName("");
      setPhone("");
      setAddress("");
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

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      full_name: fullName.trim(),
      phone: phone.trim(),
      address: address.trim(),
    });
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-5 text-xl font-semibold text-slate-800">
        {initialData ? "Edit Customer" : "Add New Customer"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter customer full name"
            className={`w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.fullName ? "border-red-400" : "border-slate-300"
            }`}
          />
          {errors.fullName && (
            <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Enter 10-digit mobile number"
            maxLength={10}
            className={`w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.phone ? "border-red-400" : "border-slate-300"
            }`}
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Address
          </label>
          <textarea
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter customer address (optional)"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? "Saving..."
              : initialData
              ? "Update Customer"
              : "Add Customer"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
