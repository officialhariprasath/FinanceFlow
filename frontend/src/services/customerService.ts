import api from "../api/axios";
import type { Customer, CustomerCreate } from "../types/customer";
import type { CustomerLedger } from "../types/ledger";

export async function getCustomers(): Promise<Customer[]> {
  const response = await api.get<Customer[]>("/customers/");
  return response.data;
}

export async function createCustomer(data: CustomerCreate): Promise<Customer> {
  const response = await api.post<Customer>("/customers/", data);
  return response.data;
}

export async function updateCustomer(
  customerId: number,
  data: CustomerCreate
): Promise<Customer> {
  const response = await api.put<Customer>(`/customers/${customerId}`, data);
  return response.data;
}

export async function deleteCustomer(customerId: number): Promise<void> {
  await api.delete(`/customers/${customerId}`);
}

export async function getCustomerLedger(
  customerId: number
): Promise<CustomerLedger> {
  const response = await api.get<CustomerLedger>(
    `/customers/${customerId}/ledger`
  );
  return response.data;
}
