import api from "../api/axios";
import type { PaymentResponse, PaymentCreate } from "../types/payment";

export async function createPayment(
  data: PaymentCreate
): Promise<PaymentResponse> {
  const response = await api.post<PaymentResponse>("/payments/", data);
  return response.data;
}

export async function getLoanPayments(
  loanId: number
): Promise<PaymentResponse[]> {
  const response = await api.get<PaymentResponse[]>(
    `/payments/loan/${loanId}`
  );
  return response.data;
}

export async function deletePayment(
  paymentId: number
): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(
    `/payments/${paymentId}`
  );
  return response.data;
}
