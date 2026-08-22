import { useEffect, useMemo, useState } from "react";

import MainLayout from "../../components/layout/MainLayout";
import CustomerTable from "../../components/customers/CustomerTable";
import CustomerForm from "../../components/customers/CustomerForm";
import DeleteCustomerModal from "../../components/customers/DeleteCustomerModal";

import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../../services/customerService";
import { getLoans } from "../../services/loanService";

import type { Customer, CustomerCreate } from "../../types/customer";
import { useToast } from "../../context/ToastContext";

function CustomersPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeCustomerIds, setActiveCustomerIds] = useState<Set<number>>(
    new Set()
  );
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(
    null
  );

  async function loadData() {
    try {
      setPageLoading(true);
      setPageError("");

      const [customerList, loanList] = await Promise.all([
        getCustomers(),
        getLoans(),
      ]);

      setCustomers(customerList);

      // Build set of customer IDs that have at least one ACTIVE loan
      const ids = new Set<number>();
      loanList.forEach((loan) => {
        if (loan.status === "ACTIVE") ids.add(loan.customer_id);
      });
      setActiveCustomerIds(ids);
    } catch {
      setPageError("Failed to load customers. Please try again.");
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openAddForm() {
    setEditingCustomer(null);
    setFormError("");
    setShowForm(true);
  }

  function openEditForm(customer: Customer) {
    setEditingCustomer(customer);
    setFormError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingCustomer(null);
    setFormError("");
  }

  async function handleFormSubmit(data: CustomerCreate) {
    try {
      setSaving(true);
      setFormError("");
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, data);
      } else {
        await createCustomer(data);
      }
      await loadData();
      closeForm();
      toast.success(editingCustomer ? "Customer updated." : "Customer added.");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setFormError(
        typeof detail === "string"
          ? detail
          : editingCustomer
          ? "Failed to update customer."
          : "Failed to add customer."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!customerToDelete) return;
    try {
      setDeleting(true);
      await deleteCustomer(customerToDelete.id);
      await loadData();
      setCustomerToDelete(null);
      toast.success("Customer deleted.");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setPageError(
        typeof detail === "string" ? detail : "Failed to delete customer."
      );
      setCustomerToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  // Apply search filter first, then split into two groups
  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return customers;
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(value) ||
        c.phone.toLowerCase().includes(value)
    );
  }, [customers, search]);

  const withActiveLoans = useMemo(
    () => filtered.filter((c) => activeCustomerIds.has(c.id)),
    [filtered, activeCustomerIds]
  );

  const withoutActiveLoans = useMemo(
    () => filtered.filter((c) => !activeCustomerIds.has(c.id)),
    [filtered, activeCustomerIds]
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="page-title">Customers</h1>
            <p className="page-subtitle">
              {customers.length} customer{customers.length !== 1 ? "s" : ""}{" "}
              registered
            </p>
          </div>
          <button
            onClick={openAddForm}
            className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
          >
            + Add Customer
          </button>
        </div>

        {/* Search */}
        <div className="surface-card p-4">
          <input
            type="text"
            placeholder="Search by name or phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {pageError && (
          <div className="rounded-lg alert-error border p-4 text-red-700">
            {pageError}
          </div>
        )}

        {pageLoading ? (
          <div className="surface-card p-10 text-center text-muted">
            Loading customers...
          </div>
        ) : filtered.length === 0 ? (
          <div className="surface-card p-10 text-center text-muted">
            No customers found.
          </div>
        ) : (
          <>
            {/* Section 1 — Customers with active loans */}
            {withActiveLoans.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h2 className="section-title">
                    Active Borrowers
                  </h2>
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    {withActiveLoans.length} customer
                    {withActiveLoans.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <CustomerTable
                  customers={withActiveLoans}
                  onEdit={openEditForm}
                  onDelete={(c) => setCustomerToDelete(c)}
                />
              </div>
            )}

            {/* Section 2 — Customers without active loans */}
            {withoutActiveLoans.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h2 className="section-title">
                    No Active Loans
                  </h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {withoutActiveLoans.length} customer
                    {withoutActiveLoans.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <CustomerTable
                  customers={withoutActiveLoans}
                  onEdit={openEditForm}
                  onDelete={(c) => setCustomerToDelete(c)}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="modal-backdrop">
          <div className="w-full max-w-lg rounded-xl bg-white p-1 shadow-xl dark:bg-slate-800">
            {formError && (
              <div className="mb-3 rounded-lg alert-error border p-3 text-sm text-red-700">
                {formError}
              </div>
            )}
            <CustomerForm
              initialData={editingCustomer}
              loading={saving}
              onSubmit={handleFormSubmit}
              onCancel={closeForm}
            />
          </div>
        </div>
      )}

      <DeleteCustomerModal
        customer={customerToDelete}
        hasActiveLoans={customerToDelete ? activeCustomerIds.has(customerToDelete.id) : false}
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setCustomerToDelete(null)}
      />
    </MainLayout>
  );
}

export default CustomersPage;
