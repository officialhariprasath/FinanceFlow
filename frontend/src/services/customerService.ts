import api from "../api/axios";

import type {
  Customer,
  CustomerCreate,
} from "../types/customer";

import type { CustomerLedger } from "../types/ledger";

function authHeader() {
  const token = localStorage.getItem("access_token");

  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function getCustomers(): Promise<Customer[]> {
  const response = await api.get<Customer[]>("/customers/", {
    headers: authHeader(),
  });

  return response.data;
}

export async function createCustomer(
  data: CustomerCreate
): Promise<Customer> {
  const response = await api.post<Customer>(
    "/customers/",
    data,
    {
      headers: authHeader(),
    }
  );

  return response.data;
}

export async function getCustomerLedger(
  customerId: number
): Promise<CustomerLedger> {
  const response = await api.get<CustomerLedger>(
    `/customers/${customerId}/ledger`,
    {
      headers: authHeader(),
    }
  );

  return response.data;
}