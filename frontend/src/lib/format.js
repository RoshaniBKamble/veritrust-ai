import { HeartPulse, Car, Home, Plane, Shield } from "lucide-react";

export const CATEGORIES = [
  { id: "health", label: "Health Insurance", icon: HeartPulse, color: "#10B981" },
  { id: "vehicle", label: "Vehicle Insurance", icon: Car, color: "#3B82F6" },
  { id: "home", label: "Home / Property", icon: Home, color: "#F59E0B" },
  { id: "travel", label: "Travel Insurance", icon: Plane, color: "#8B5CF6" },
  { id: "life", label: "Life Insurance", icon: Shield, color: "#EC4899" },
];

export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिंदी" },
  { code: "mr", label: "Marathi", native: "मराठी" },
];

export const SPEECH_LANG = { en: "en-US", hi: "hi-IN", mr: "mr-IN" };

export function categoryMeta(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
}

export function riskColor(score) {
  if (score == null) return "#64748B";
  if (score <= 35) return "#10B981";
  if (score <= 69) return "#F59E0B";
  return "#EF4444";
}

export function riskBadgeClass(level) {
  switch (level) {
    case "Low": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    case "Medium": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "High": return "bg-rose-500/10 text-rose-400 border-rose-500/30";
    default: return "bg-slate-500/10 text-slate-400 border-slate-500/30";
  }
}

export function shortHash(h, n = 10) {
  if (!h) return "";
  return h.length > n * 2 ? `${h.slice(0, n)}…${h.slice(-6)}` : h;
}

export function fmtDate(d) {
  try { return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

export function expiryMeta(days) {
  if (days == null) return null;
  if (days < 0) return { label: "Expired", color: "#EF4444", cls: "bg-rose-500/10 text-rose-400 border-rose-500/30" };
  if (days <= 7) return { label: days === 0 ? "Expires today" : `${days}d left`, color: "#EF4444", cls: "bg-rose-500/10 text-rose-400 border-rose-500/30" };
  if (days <= 30) return { label: `${days}d left`, color: "#F59E0B", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
  return { label: `${days}d left`, color: "#10B981", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
}

export function severityClass(sev) {
  switch (sev) {
    case "critical": return "border-rose-500/40 bg-rose-500/5";
    case "high": return "border-rose-500/30 bg-rose-500/5";
    case "medium": return "border-amber-500/30 bg-amber-500/5";
    default: return "border-blue-500/30 bg-blue-500/5";
  }
}

export const notifyAlertsChanged = () => window.dispatchEvent(new Event("veritrust:alerts-changed"));
