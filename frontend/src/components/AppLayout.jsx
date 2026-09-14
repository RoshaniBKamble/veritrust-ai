import { useState, useEffect, useCallback } from "react";
import { NavLink, useNavigate, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, UploadCloud, FolderClock, GitCompare, MessageSquareText,
  ShieldCheck, User, LogOut, Menu, X, Hexagon, Bell,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-link-dashboard" },
  { to: "/upload", label: "Upload Policy", icon: UploadCloud, testid: "nav-link-upload" },
  { to: "/policies", label: "Policy History", icon: FolderClock, testid: "nav-link-policies" },
  { to: "/compare", label: "Compare", icon: GitCompare, testid: "nav-link-compare" },
  { to: "/ask-ai", label: "Ask VeriTrust AI", icon: MessageSquareText, testid: "nav-link-ask-ai" },
  { to: "/verify", label: "Verification Center", icon: ShieldCheck, testid: "nav-link-verify" },
  { to: "/alerts", label: "Alerts & Renewals", icon: Bell, testid: "nav-link-alerts" },
];

function AlertBell({ counts }) {
  const fraud = counts?.fraud > 0;
  return (
    <Link to="/alerts" data-testid="nav-alert-bell" title="Alerts & Renewals"
      className="relative p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 transition-colors">
      <Bell className={`h-5 w-5 ${fraud ? "text-rose-400" : "text-slate-300"}`} />
      {counts?.unread > 0 && (
        <span data-testid="nav-alert-bell-count"
          className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold grid place-items-center text-slate-950 ${fraud ? "bg-rose-400" : "bg-amber-400"}`}>
          {counts.unread > 9 ? "9+" : counts.unread}
        </span>
      )}
    </Link>
  );
}

function Brand() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5" data-testid="nav-brand-logo">
      <div className="relative grid place-items-center">
        <Hexagon className="h-9 w-9 text-emerald-400" strokeWidth={1.5} />
        <ShieldCheck className="h-4 w-4 text-emerald-300 absolute" />
      </div>
      <div className="leading-tight">
        <div className="font-display font-extrabold text-lg tracking-tight">VeriTrust<span className="text-emerald-400"> AI</span></div>
      </div>
    </Link>
  );
}

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState(null);

  const refreshCounts = useCallback(() => {
    api.get("/alerts", { params: { status: "ACTIVE" } }).then((r) => setCounts(r.data.counts)).catch(() => {});
  }, []);

  useEffect(() => { refreshCounts(); }, [location.pathname, refreshCounts]);
  useEffect(() => {
    window.addEventListener("veritrust:alerts-changed", refreshCounts);
    return () => window.removeEventListener("veritrust:alerts-changed", refreshCounts);
  }, [refreshCounts]);

  const initials = (user?.full_name || "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const SideContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-6 flex items-center justify-between"><Brand /><AlertBell counts={counts} /></div>
      <nav className="flex-1 px-3 space-y-1">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} data-testid={n.testid} onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive ? "bg-emerald-500/12 text-emerald-300 border border-emerald-500/25"
                         : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent"
              }`
            }>
            <n.icon className="h-[18px] w-[18px]" /> {n.label}
            {n.to === "/alerts" && counts?.active > 0 && (
              <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${counts.fraud > 0 ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>{counts.active}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-800/70">
        <NavLink to="/profile" data-testid="nav-user-menu-trigger"
          className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-800/50 transition-colors">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 grid place-items-center text-xs font-bold text-slate-950">{initials}</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{user?.full_name}</div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>
        </NavLink>
        <button onClick={() => { logout(); navigate("/login"); }} data-testid="nav-logout-button"
          className="mt-1 w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors">
          <LogOut className="h-[18px] w-[18px]" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen app-bg text-slate-100">
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-72 shrink-0 h-screen sticky top-0 glass border-r border-slate-800/60 flex-col">
          <SideContent />
        </aside>

        {/* Mobile top bar */}
        <div className="lg:hidden fixed top-0 inset-x-0 z-40 glass border-b border-slate-800/60 flex items-center justify-between px-4 h-16">
          <Brand />
          <div className="flex items-center gap-2">
            <AlertBell counts={counts} />
            <button onClick={() => setOpen(true)} data-testid="mobile-menu-open" className="p-2 rounded-lg bg-slate-800/60"><Menu className="h-5 w-5" /></button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div className="lg:hidden fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
              <motion.aside className="absolute left-0 top-0 h-full w-72 glass border-r border-slate-800/60"
                initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", damping: 26 }}>
                <button onClick={() => setOpen(false)} className="absolute right-3 top-4 p-2"><X className="h-5 w-5" /></button>
                <SideContent />
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-1 min-w-0 pt-16 lg:pt-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
