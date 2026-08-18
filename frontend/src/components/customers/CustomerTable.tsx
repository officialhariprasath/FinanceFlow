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
      <div className="surface-card p-10 text-center text-muted">
        No customers found.
      </div>
    );
  }

  return (
    <div className="surface-card overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Full Name</th>
            <th>Phone</th>
            <th>Permanent Address</th>
            <th>Temporary Address</th>
            <th className="text-center">Actions</th>
          </tr>
        </thead>

        <tbody>
          {customers.map((customer) => (
            <tr
              key={customer.id}
              className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              <td className="text-muted">{customer.id}</td>
              <td className="font-medium text-slate-800 dark:text-slate-100">
                {customer.full_name}
              </td>
              <td className="text-muted">{customer.phone}</td>
              <td className="text-muted">{customer.permanent_address || "—"}</td>
              <td className="text-muted">{customer.temporary_address || "—"}</td>

              <td>
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
