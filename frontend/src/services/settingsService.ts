import api from "../api/axios";
import type { FinanceSettings, FinanceSettingsUpdate } from "../types/settings";

export async function getSettings(): Promise<FinanceSettings> {
  const response = await api.get<FinanceSettings>("/settings/");
  return response.data;
}

export async function updateSettings(
  data: FinanceSettingsUpdate
): Promise<FinanceSettings> {
  const response = await api.put<FinanceSettings>("/settings/", data);
  return response.data;
}
