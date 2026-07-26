import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/customers", label: "Customers" },
  { to: "/loans", label: "Loans" },
  { to: "/payments", label: "Payments" },
  { to: "/renewals", label: "Renewals" },
  { to: "/settings", label: "Settings" },
];

function Sidebar() {
  return (
    <aside className="min-h-screen w-64 bg-blue-700 text-white flex-shrink-0">
      <div className="flex h-16 items-center justify-center border-b border-blue-600">
        <h1 className="text-xl font-bold tracking-wide">FINNECT</h1>
      </div>
      <nav className="space-y-1 p-4">
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `block w-full rounded px-4 py-3 text-sm font-medium transition-colors ${
                isActive ? "bg-blue-800" : "hover:bg-blue-600"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
