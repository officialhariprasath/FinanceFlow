import api from "../api/axios";
import type { PaymentResponse, PaymentCreate } from "../types/payment";

export async function createPayment(
  data: PaymentCreate
): Promise<PaymentResponse> {
  const response = await api.post<PaymentResponse>("/payments/", data);
  return response.data;
}

export async function previewPayment(
  loanId: number,
  paymentDate: string,
  amountPaid: string,
  scheduleDates?: string[]
): Promise<{
  principal_amount: string;
  profit_amount: string;
  total_amount: string;
  installment_count?: number;
}> {
  const response = await api.get("/payments/preview", {
    params: {
      loan_id: loanId,
      payment_date: paymentDate,
      amount_paid: amountPaid,
      ...(scheduleDates?.length
        ? { schedule_dates: scheduleDates }
        : {}),
    },
    paramsSerializer: {
      indexes: null,
    },
  });
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
