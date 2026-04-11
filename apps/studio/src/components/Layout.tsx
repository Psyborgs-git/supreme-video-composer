import { useState, useEffect, useRef } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  const saved = localStorage.getItem("theme") as Theme | null;
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const Layout: React.FC = () => {
  const location = useLocation();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const orgMenuRef = useRef<HTMLDivElement>(null);

  const { user, orgs, currentOrg, switchOrg, logout, initialize } = useAuthStore();

  // Initialize auth on mount
  useEffect(() => {
    initialize();
  }, []);

  // Apply .dark class to <html> and persist
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setOrgMenuOpen(false);
  }, [location.pathname]);

  // Close org menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (orgMenuRef.current && !orgMenuRef.current.contains(e.target as Node)) {
        setOrgMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const navLinks = [
    { to: "/", label: "Templates" },
    { to: "/templates/new", label: "Create Template" },
    { to: "/projects", label: "Projects" },
    { to: "/assets", label: "Assets" },
    { to: "/automations", label: "Automations" },
  ];

  const isActive = (to: string) =>
    to === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(to);

  const navLinkClass = (to: string) =>
    `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive(to)
        ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50"
        : "text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800"
    }`;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 transition-colors">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-40 transition-colors">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
              M
            </div>
            <span className="text-base sm:text-lg font-semibold hidden xs:block">Media Studio</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label }) => (
              <Link key={to} to={to} className={navLinkClass(to)}>
                {label}
              </Link>
            ))}
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Org switcher */}
            {user && currentOrg && (
              <div ref={orgMenuRef} className="relative">
                <button
                  onClick={() => setOrgMenuOpen((o) => !o)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <span className="max-w-28 truncate">{currentOrg.name}</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {orgMenuOpen && (
                  <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-lg py-1 z-50">
                    <p className="px-3 py-1.5 text-xs text-gray-400 dark:text-zinc-500 font-medium uppercase tracking-wide">Organisations</p>
                    {orgs.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => { switchOrg(org.slug); setOrgMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors ${
                          org.id === currentOrg.id ? "text-blue-600 dark:text-blue-400 font-medium" : "text-gray-700 dark:text-zinc-300"
                        }`}
                      >
                        {org.name}
                      </button>
                    ))}
                    <div className="border-t border-gray-100 dark:border-zinc-800 my-1" />
                    <Link
                      to="/orgs/new"
                      className="block px-3 py-2 text-sm text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                      onClick={() => setOrgMenuOpen(false)}
                    >
                      + New organisation
                    </Link>
                    <div className="border-t border-gray-100 dark:border-zinc-800 my-1" />
                    <Link
                      to="/settings/profile"
                      className="block px-3 py-2 text-sm text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                      onClick={() => setOrgMenuOpen(false)}
                    >
                      Profile settings
                    </Link>
                    <Link
                      to="/settings/members"
                      className="block px-3 py-2 text-sm text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                      onClick={() => setOrgMenuOpen(false)}
                    >
                      Team members
                    </Link>
                    <Link
                      to="/settings/billing"
                      className="block px-3 py-2 text-sm text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                      onClick={() => setOrgMenuOpen(false)}
                    >
                      Billing
                    </Link>
                    <div className="border-t border-gray-100 dark:border-zinc-800 my-1" />
                    <button
                      onClick={() => { logout(); setOrgMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Login link (when unauthenticated) */}
            {!user && (
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                Sign in
              </Link>
            )}

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                // Sun icon
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                // Moon icon
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-gray-200 dark:border-zinc-800 px-4 py-2 flex flex-col gap-1">
            {navLinks.map(({ to, label }) => (
              <Link key={to} to={to} className={navLinkClass(to)}>
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {/* Main content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
};
