import { useNavigate } from "react-router-dom";
import type { Customer } from "../../types/customer";

type CustomerTableProps = {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
};

function CustomerTable({
  customers,
  onEdit,
  onDelete,
}: CustomerTableProps) {
  const navigate = useNavigate();

  if (customers.length === 0) {
    return (
      <div className="rounded-lg bg-white p-10 text-center text-slate-500 shadow">
        No customers found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <table className="min-w-full">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
              ID
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
              Full Name
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
              Phone
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
              Address
            </th>
            <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {customers.map((customer) => (
            <tr
              key={customer.id}
              className="border-t transition-colors hover:bg-slate-50"
            >
              <td className="px-6 py-4 text-slate-600">{customer.id}</td>

              <td className="px-6 py-4 font-medium text-slate-800">
                {customer.full_name}
              </td>

              <td className="px-6 py-4 text-slate-600">{customer.phone}</td>

              <td className="px-6 py-4 text-slate-600">
                {customer.address || "—"}
              </td>

              <td className="px-6 py-4">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() =>
                      navigate(`/customers/${customer.id}/ledger`)
                    }
                    className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    View
                  </button>

                  <button
                    onClick={() => onEdit(customer)}
                    className="rounded bg-amber-500 px-3 py-1 text-sm font-medium text-white hover:bg-amber-600"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => onDelete(customer)}
                    className="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CustomerTable;
