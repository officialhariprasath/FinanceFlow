import { useEffect, useState } from "react";
import type {
  Customer,
  CustomerCreate,
} from "../../types/customer";

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

  useEffect(() => {
    if (initialData) {
      setFullName(initialData.full_name);
      setPhone(initialData.phone);
      setAddress(initialData.address);
    } else {
      setFullName("");
      setPhone("");
      setAddress("");
    }
  }, [initialData]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    onSubmit({
      full_name: fullName.trim(),
      phone: phone.trim(),
      address: address.trim(),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-lg bg-white p-6 shadow"
    >
      <div>
        <label className="mb-2 block font-medium">
          Full Name
        </label>

        <input
          type="text"
          value={fullName}
          onChange={(e) =>
            setFullName(e.target.value)
          }
          required
          className="w-full rounded-lg border px-4 py-3"
        />
      </div>

      <div>
        <label className="mb-2 block font-medium">
          Mobile Number
        </label>

        <input
          type="text"
          value={phone}
          onChange={(e) =>
            setPhone(e.target.value)
          }
          required
          className="w-full rounded-lg border px-4 py-3"
        />
      </div>

      <div>
        <label className="mb-2 block font-medium">
          Address
        </label>

        <textarea
          rows={3}
          value={address}
          onChange={(e) =>
            setAddress(e.target.value)
          }
          required
          className="w-full rounded-lg border px-4 py-3"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
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
          className="rounded-lg border px-5 py-3"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}