import { Outlet, Link, useLocation } from "react-router-dom";

export const Layout: React.FC = () => {
  const location = useLocation();

  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      className={`hover:text-zinc-100 transition-colors ${
        location.pathname === to || (to !== "/" && location.pathname.startsWith(to))
          ? "text-zinc-100 font-medium"
          : ""
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">
            M
          </div>
          <span className="text-lg font-semibold">Media Studio</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-zinc-400">
          {navLink("/", "Templates")}
          {navLink("/projects", "Projects")}
          {navLink("/assets", "Assets")}
        </nav>
      </header>

      {/* Main content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
};
