import { useState, type ReactNode } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

type MainLayoutProps = {
  children: ReactNode;
};

function MainLayout({ children }: MainLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-100 dark:bg-slate-900">
      {/* Mobile overlay */}
      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar — drawer on mobile, fixed column on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-out lg:relative lg:shrink-0 lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onNavigate={() => setMenuOpen(false)} />
      </div>

      {/* Main column — only this area scrolls */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar onMenuClick={() => setMenuOpen((o) => !o)} menuOpen={menuOpen} />
        <main
          className="min-w-0 flex-1 overflow-y-auto overscroll-y-contain bg-slate-100 p-4 sm:p-6 dark:bg-slate-900"
        >
          <div className="mx-auto w-full min-w-0 max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
