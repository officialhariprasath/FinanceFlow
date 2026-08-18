import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import {
  getNotificationCount,
  getNotifications,
  markNotificationRead,
  type Notification,
} from "../../services/extendedService";

function levelClass(level: string) {
  if (level === "warning") return "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40";
  if (level === "success") return "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40";
  return "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50";
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const auditPath = session?.is_owner ? "/audit" : "/settings";

  const refresh = useCallback(async () => {
    try {
      const [count, list] = await Promise.all([
        getNotificationCount(),
        getNotifications(false),
      ]);
      setUnreadCount(count.unread_count);
      setItems(list.slice(0, 8));
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 60000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function handleOpen() {
    setOpen((v) => !v);
    if (!open) {
      setLoading(true);
      await refresh();
      setLoading(false);
    }
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.is_read) await markNotificationRead(n.id);
    if (n.action_url) {
      navigate(n.action_url);
      setOpen(false);
    }
    await refresh();
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="font-semibold text-slate-800 dark:text-slate-100">Notifications</p>
            <Link
              to={auditPath}
              onClick={() => setOpen(false)}
              className="text-xs text-blue-700 hover:underline dark:text-blue-400"
            >
              View all
            </Link>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-sm text-slate-500">Loading...</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">No notifications.</p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                        n.action_url ? "cursor-pointer" : ""
                      }`}
                    >
                      <div
                        className={`rounded-lg border p-3 ${levelClass(n.level)} ${
                          !n.is_read ? "ring-1 ring-blue-200 dark:ring-blue-800" : ""
                        }`}
                      >
                        <p className="font-medium text-slate-800 dark:text-slate-100">{n.title}</p>
                        <p className="mt-1 text-slate-600 dark:text-slate-300">{n.message}</p>
                        <p className="mt-2 text-xs text-slate-400">
                          {new Date(n.created_at).toLocaleString("en-IN")}
                          {n.action_url ? " · Tap to open" : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
