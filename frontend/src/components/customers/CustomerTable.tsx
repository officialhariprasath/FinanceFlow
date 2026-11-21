import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Customer } from "../../types/customer";
import ScrollableTable from "../common/ScrollableTable";
import {
  OCCUPATION_LABELS,
  kycStatusLabel,
  labelOrDash,
} from "../../utils/customerKycDisplay";

type CustomerTableProps = {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  canEdit?: boolean;
};

function CustomerTable({
  customers,
  onEdit,
  canEdit = true,
}: CustomerTableProps) {
  const navigate = useNavigate();
  const [menuId, setMenuId] = useState<number | null>(null);

  if (customers.length === 0) {
    return (
      <div className="surface-card p-10 text-center text-muted">
        No customers found.
      </div>
    );
  }

  function Actions({ customer }: { customer: Customer }) {
    const open = menuId === customer.id;
    return (
      <div
        className="relative inline-block text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
          onClick={() => setMenuId(open ? null : customer.id)}
        >
          Actions
        </button>
        {open && (
          <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
              onClick={() => {
                setMenuId(null);
                navigate(`/customers/${customer.id}/ledger`);
              }}
            >
              View
            </button>
            {canEdit && (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                onClick={() => {
                  setMenuId(null);
                  onEdit(customer);
                }}
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="surface-card" onClick={() => setMenuId(null)}>
      <div className="space-y-3 p-4 sm:hidden">
        {customers.map((customer) => {
          const chip = kycStatusLabel(customer);
          return (
            <div
              key={customer.id}
              className="cursor-pointer rounded-lg border border-slate-200 p-4 dark:border-slate-600"
              onClick={() => navigate(`/customers/${customer.id}/ledger`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      {customer.full_name}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        chip.tone === "ok"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {chip.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted">{customer.phone}</p>
                  {customer.occupation && (
                    <p className="text-xs text-muted">
                      {labelOrDash(customer.occupation, OCCUPATION_LABELS)}
                      {customer.area_landmark
                        ? ` · ${customer.area_landmark}`
                        : ""}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted line-clamp-2">
                    {customer.permanent_address || "—"}
                  </p>
                </div>
                <Actions customer={customer} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden sm:block">
        <p className="table-scroll-hint">Swipe sideways to see all columns</p>
        <ScrollableTable>
          <table className="data-table table-wide-lg">
            <thead className="table-head">
              <tr>
                <th>ID</th>
                <th>Full Name</th>
                <th>Phone</th>
                <th>Work / Area</th>
                <th>KYC</th>
                <th>Permanent Address</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const chip = kycStatusLabel(customer);
                return (
                  <tr
                    key={customer.id}
                    onClick={() => navigate(`/customers/${customer.id}/ledger`)}
                    className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="text-muted">
                      {customer.display_code || `#${customer.id}`}
                    </td>
                    <td className="font-medium text-slate-800 dark:text-slate-100">
                      {customer.full_name}
                    </td>
                    <td className="text-muted">{customer.phone}</td>
                    <td className="text-muted">
                      {customer.occupation || customer.area_landmark
                        ? [
                            customer.occupation
                              ? labelOrDash(
                                  customer.occupation,
                                  OCCUPATION_LABELS
                                )
                              : null,
                            customer.area_landmark || null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "—"}
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          chip.tone === "ok"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {chip.label}
                      </span>
                    </td>
                    <td className="text-muted">
                      {customer.permanent_address || "—"}
                    </td>
                    <td className="text-right">
                      <Actions customer={customer} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollableTable>
      </div>
    </div>
  );
}

export default CustomerTable;
