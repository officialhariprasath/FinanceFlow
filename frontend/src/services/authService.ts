import api from "../api/axios";

export async function login(identifier: string, password: string) {
  const formData = new URLSearchParams();
  formData.append("username", identifier.trim());
  formData.append("password", password);
  const response = await api.post("/finance-owners/login", formData, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return response.data;
}

export interface RegisterRequest {
  business_name: string;
  owner_name: string;
  phone: string;
  email: string;
  address: string;
  password: string;
  otp_code: string;
}

export async function register(data: RegisterRequest) {
  const response = await api.post("/finance-owners/register", data);
  return response.data;
}

export async function getProfile() {
  const response = await api.get("/finance-owners/me");
  return response.data;
}

export type OtpPurpose = "register_owner" | "register_agent" | "reset_password";

export type OtpResponse = {
  ok: boolean;
  email: string;
  purpose: string;
  mailed: boolean;
  message: string;
  dev_code?: string;
  mail_error?: string;
};

export async function sendOtp(email: string, purpose: OtpPurpose): Promise<OtpResponse> {
  const response = await api.post<OtpResponse>("/auth/send-otp", { email, purpose });
  return response.data;
}

export async function forgotPassword(identifier: string): Promise<OtpResponse> {
  const response = await api.post<OtpResponse>("/auth/forgot-password", { identifier });
  return response.data;
}

export async function resetPassword(
  identifier: string,
  code: string,
  new_password: string
) {
  const response = await api.post("/auth/reset-password", {
    identifier,
    code,
    new_password,
  });
  return response.data;
}
