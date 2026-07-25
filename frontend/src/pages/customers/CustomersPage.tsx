import { useEffect, useMemo, useState } from "react";

import MainLayout from "../../components/layout/MainLayout";
import CustomerTable from "../../components/customers/CustomerTable";
import CustomerForm from "../../components/customers/CustomerForm";

import {
  getCustomers,
  createCustomer,
} from "../../services/customerService";

import type {
  Customer,
  CustomerCreate,
} from "../../types/customer";

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [pageLoading, setPageLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);

  async function loadCustomers() {
    try {
      setPageLoading(true);
      setError("");

      const customerList = await getCustomers();

      setCustomers(customerList);
    } catch {
      setError("Failed to load customers.");
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  async function handleCreateCustomer(
    data: CustomerCreate
  ) {
    try {
      setSaving(true);

      await createCustomer(data);

      await loadCustomers();

      setShowForm(false);
    } catch {
      alert("Failed to add customer.");
    } finally {
      setSaving(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return customers;
    }

    return customers.filter(
      (customer) =>
        customer.full_name
          .toLowerCase()
          .includes(value) ||
        customer.phone
          .toLowerCase()
          .includes(value)
    );
  }, [customers, search]);
    return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Customers
            </h1>

            <p className="text-slate-500">
              Manage all finance customers.
            </p>
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
          >
            Add Customer
          </button>
        </div>

        <div className="rounded-lg bg-white p-4 shadow">
          <input
            type="text"
            placeholder="Search by customer name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border px-4 py-3"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {pageLoading ? (
          <div className="rounded-lg bg-white p-10 text-center shadow">
            Loading customers...
          </div>
        ) : (
          <CustomerTable customers={filteredCustomers} />
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl">
              <CustomerForm
                loading={saving}
                onSubmit={handleCreateCustomer}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default CustomersPage;