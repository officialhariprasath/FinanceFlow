import api from "../api/axios";
import type { CollectionSummary } from "../types/collection";

export async function getTodayCollections(
  targetDate?: string
): Promise<CollectionSummary> {
  const response = await api.get<CollectionSummary>("/collections/today", {
    params: targetDate ? { target_date: targetDate } : undefined,
  });
  return response.data;
}
