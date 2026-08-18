import { useLocation } from "react-router-dom";

import { PAGE_TITLES } from "../../config/nav";
import NotificationBell from "./NotificationBell";

interface Props {
  onMenuClick?: () => void;
  menuOpen?: boolean;
}

function Navbar({ onMenuClick, menuOpen }: Props) {
  const location = useLocation();

  const title =
    Object.entries(PAGE_TITLES).find(([path]) =>
      location.pathname.startsWith(path)
    )?.[1] ?? "FinanceFlow";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-800 sm:h-16 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={onMenuClick}
          className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <h1 className="truncate section-title dark:text-slate-100 sm:text-xl">
          {title}
        </h1>
      </div>
      <NotificationBell />
    </header>
  );
}

export default Navbar;
