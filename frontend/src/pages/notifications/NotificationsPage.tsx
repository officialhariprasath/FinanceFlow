import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import MainLayout from "../../components/layout/MainLayout";
import { PageError, PageLoading } from "../../components/common/PageStates";
import {
  getNotifications,
  markNotificationRead,
  type Notification,
} from "../../services/extendedService";

function levelClass(level: string) {
  if (level === "warning")
    return "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40";
  if (level === "success")
    return "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40";
  return "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50";
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setItems(await getNotifications());
    } catch {
      setError("Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleClick(n: Notification) {
    if (!n.is_read) await markNotificationRead(n.id);
    if (n.action_url) navigate(n.action_url);
    else await load();
  }

  async function handleMarkRead(id: number) {
    await markNotificationRead(id);
    await load();
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">Alerts and updates for your account.</p>
        </div>

        {error && <PageError message={error} />}

        {loading ? (
          <PageLoading message="Loading notifications..." />
        ) : (
          <div className="surface-card">
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {items.length === 0 ? (
                <li className="px-6 py-10 text-center text-sm text-slate-500">
                  No notifications.
                </li>
              ) : (
                items.map((n) => (
                  <li key={n.id} className="px-4 py-3 sm:px-6">
                    <div
                      className={`rounded-lg border p-4 ${levelClass(n.level)} ${
                        !n.is_read ? "ring-1 ring-blue-200 dark:ring-blue-800" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => handleClick(n)}
                          className={`min-w-0 flex-1 text-left ${
                            n.action_url ? "cursor-pointer" : "cursor-default"
                          }`}
                        >
                          <p className="font-medium text-slate-800 dark:text-slate-100">
                            {n.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {n.message}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            {new Date(n.created_at).toLocaleString("en-IN")}
                            {n.action_url ? " · Tap to open" : ""}
                          </p>
                        </button>
                        {!n.is_read && (
                          <button
                            type="button"
                            onClick={() => handleMarkRead(n.id)}
                            className="shrink-0 text-sm text-blue-700 dark:text-blue-400"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
