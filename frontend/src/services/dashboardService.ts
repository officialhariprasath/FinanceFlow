import api from "../api/axios";
import type { DashboardResponse } from "../types/dashboard";

export const getDashboard = async (): Promise<DashboardResponse> => {
  const token = localStorage.getItem("access_token");

  const response = await api.get<DashboardResponse>("/dashboard", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};