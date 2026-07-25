import api from "../api/axios";

export async function login(email: string, password: string) {
  const formData = new URLSearchParams();

  formData.append("username", email);
  formData.append("password", password);

  const response = await api.post(
    "/finance-owners/login",
    formData,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return response.data;
}

export interface RegisterRequest {
  business_name: string;
  owner_name: string;
  phone: string;
  email: string;
  address: string;
  password: string;
}

export async function register(data: RegisterRequest) {
  const response = await api.post(
    "/finance-owners/register",
    data
  );

  return response.data;
}