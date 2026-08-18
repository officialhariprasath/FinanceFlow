import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNavBadges } from "../../context/NavBadgesContext";
import { NAV_GROUPS, type NavGroup, type NavItem } from "../../config/nav";

interface Props {
  onNavigate?: () => void;
}

const STORAGE_KEY = "financeflow_sidebar_expanded";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function Sidebar({ onNavigate }: Props) {
  const { session, hasPermission } = useAuth();
  const { pendingSettlements, agentPendingSettlement } = useNavBadges();
  const location = useLocation();

  function filterItem(item: NavItem): boolean {
    if (item.ownerOnly && !session?.is_owner) return false;
    if (item.agentOnly && session?.is_owner) return false;
    return hasPermission(item.permission);
  }

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(filterItem),
    })).filter((g) => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, hasPermission]);

  const activeGroupId = useMemo(() => {
    const path = location.pathname;
    for (const group of visibleGroups) {
      if (group.items.some((item) => path === item.to || path.startsWith(`${item.to}/`))) {
        return group.id;
      }
    }
    return visibleGroups[0]?.id ?? "overview";
  }, [location.pathname, visibleGroups]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored) as Record<string, boolean>;
    } catch {
      /* ignore */
    }
    return {};
  });

  useEffect(() => {
    setExpanded((prev) => {
      if (prev[activeGroupId]) return prev;
      return { ...prev, [activeGroupId]: true };
    });
  }, [activeGroupId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded));
  }, [expanded]);

  function badgeFor(to: string) {
    if (to === "/agent-settlements" && pendingSettlements > 0) {
      return pendingSettlements > 9 ? "9+" : String(pendingSettlements);
    }
    if (to === "/settlements" && agentPendingSettlement) {
      return "!";
    }
    return null;
  }

  function groupBadge(group: NavGroup & { items: NavItem[] }) {
    for (const item of group.items) {
      const b = badgeFor(item.to);
      if (b) return b;
    }
    return null;
  }

  function toggleGroup(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <aside className="flex h-[100dvh] w-64 flex-col bg-blue-700 text-white dark:bg-slate-900">
      <div className="flex h-14 items-center justify-center border-b border-blue-600 dark:border-slate-700 lg:h-16">
        <h1 className="text-lg font-bold tracking-wide lg:text-xl">FinanceFlow</h1>
      </div>
      {session && (
        <div className="border-b border-blue-600 px-4 py-3 text-xs text-blue-100 dark:border-slate-700 dark:text-slate-300">
          {session.display_name}
          <span className="mt-1 block opacity-80">
            {session.is_owner ? "Owner" : "Collection Agent"}
          </span>
        </div>
      )}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {visibleGroups.map((group) => {
          const isOpen = expanded[group.id] ?? group.id === activeGroupId;
          const gBadge = groupBadge(group);

          return (
            <div key={group.id} className="rounded-lg">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-blue-100 hover:bg-blue-600/60 dark:text-slate-400 dark:hover:bg-slate-800"
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-2">
                  {group.label}
                  {gBadge && !isOpen && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {gBadge}
                    </span>
                  )}
                </span>
                <Chevron open={isOpen} />
              </button>

              {isOpen && (
                <div className="mb-1 space-y-0.5 pl-1">
                  {group.items.map(({ to, label }) => {
                    const badge = badgeFor(to);
                    return (
                      <NavLink
                        key={`${group.id}-${to}-${label}`}
                        to={to}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          `flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-blue-800 text-white dark:bg-slate-700"
                              : "text-blue-50 hover:bg-blue-600/80 dark:text-slate-200 dark:hover:bg-slate-800"
                          }`
                        }
                      >
                        <span>{label}</span>
                        {badge && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold">
                            {badge}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;
