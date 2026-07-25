import { useNavigate } from "react-router-dom";

import type { Customer } from "../../types/customer";

type CustomerTableProps = {
  customers: Customer[];
};

function CustomerTable({ customers }: CustomerTableProps) {
  const navigate = useNavigate();

  if (customers.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 text-center shadow">
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
          </tr>
        </thead>

        <tbody>
          {customers.map((customer) => (
            <tr
              key={customer.id}
              onClick={() =>
                navigate(`/customers/${customer.id}/ledger`)
              }
              className="cursor-pointer border-t transition-colors hover:bg-slate-50"
            >
              <td className="px-6 py-4">{customer.id}</td>
              <td className="px-6 py-4 font-medium">
                {customer.full_name}
              </td>
              <td className="px-6 py-4">{customer.phone}</td>
              <td className="px-6 py-4">{customer.address}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CustomerTable;