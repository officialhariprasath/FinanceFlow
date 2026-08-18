export interface NavItem {
  to: string;
  label: string;
  permission: string;
  ownerOnly?: boolean;
  agentOnly?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", permission: "dashboard" },
      { to: "/collections", label: "Collections", permission: "collections" },
    ],
  },
  {
    id: "settlements",
    label: "Settlements",
    items: [
      { to: "/settlements", label: "My Settlement", permission: "settlements", agentOnly: true },
      {
        to: "/agent-settlements",
        label: "Agent Settlements",
        permission: "agents",
        ownerOnly: true,
      },
    ],
  },
  {
    id: "lending",
    label: "Lending",
    items: [
      { to: "/customers", label: "Customers", permission: "customers" },
      { to: "/loans", label: "Loans", permission: "loans" },
      { to: "/payments", label: "Payments", permission: "payments" },
      { to: "/renewals", label: "Renewals", permission: "loans" },
      { to: "/defaults", label: "Defaults", permission: "loans", ownerOnly: true },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { to: "/capital", label: "Capital", permission: "capital" },
      { to: "/profit", label: "Profit", permission: "profit" },
      { to: "/expenses", label: "Expenses", permission: "expenses" },
      { to: "/ledgers", label: "Ledgers", permission: "ledger" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { to: "/reports", label: "Reports", permission: "reports" },
      { to: "/reconciliation", label: "Reconciliation", permission: "ledger", ownerOnly: true },
      { to: "/audit", label: "Audit", permission: "dashboard", ownerOnly: true },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      { to: "/agents", label: "Manage Agents", permission: "agents", ownerOnly: true },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      { to: "/settings", label: "Settings", permission: "settings" },
      { to: "/settings", label: "Account", permission: "dashboard", agentOnly: true },
    ],
  },
];

/** Flat list (e.g. tests, legacy imports) */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/collections": "Collections",
  "/settlements": "My Settlement",
  "/customers": "Customers",
  "/loans": "Loans",
  "/payments": "Payments",
  "/capital": "Capital",
  "/profit": "Profit",
  "/ledgers": "Ledgers",
  "/expenses": "Expenses",
  "/defaults": "Defaults",
  "/reports": "Reports",
  "/reconciliation": "Reconciliation",
  "/audit": "Audit",
  "/agents": "Manage Agents",
  "/agent-settlements": "Agent Settlements",
  "/renewals": "Renewals",
  "/settings": "Settings",
};
