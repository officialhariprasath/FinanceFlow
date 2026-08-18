import { useEffect, useState } from "react";

import MainLayout from "../../components/layout/MainLayout";
import { PageError, PageLoading } from "../../components/common/PageStates";
import {
  getAuditLogs,
  getNotifications,
  markNotificationRead,
} from "../../services/extendedService";
import type { AuditLog, Notification } from "../../services/extendedService";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [l, n] = await Promise.all([getAuditLogs(), getNotifications()]);
      setLogs(l);
      setNotifications(n);
    } catch {
      setError("Failed to load audit data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleMarkRead(id: number) {
    await markNotificationRead(id);
    await load();
  }

  if (loading) {
    return (
      <MainLayout>
        <PageLoading message="Loading audit..." />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <PageError message={error} onRetry={load} />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Audit & Notifications</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Owner activity log and system alerts</p>
        </div>

        <div className="surface-card">
          <div className="border-b px-6 py-4">
            <h2 className="section-title">Notifications</h2>
          </div>
          <ul className="divide-y">
            {notifications.length === 0 ? (
              <li className="px-6 py-6 text-sm text-gray-500 dark:text-slate-400">No notifications.</li>
            ) : (
              notifications.map((n) => (
                <li key={n.id} className="px-6 py-4 flex justify-between gap-4">
                  <div>
                    <p className="font-medium">{n.title}</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400">{n.message}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                      {new Date(n.created_at).toLocaleString("en-IN")}
                    </p>
                  </div>
                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n.id)}
                      className="text-sm text-blue-700 shrink-0"
                    >
                      Mark read
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="table-shell">
          <div className="border-b px-6 py-4">
            <h2 className="section-title">Audit log</h2>
          </div>
          <table className="min-w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Entity</th>
                <th className="px-4 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3">{new Date(log.created_at).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">{log.action}</td>
                  <td className="px-4 py-3">
                    {log.entity_type ? `${log.entity_type} #${log.entity_id}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{log.details || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
