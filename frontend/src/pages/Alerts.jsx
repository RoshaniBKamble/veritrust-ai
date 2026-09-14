import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Bell, ShieldAlert, CalendarClock, Loader2, CheckCheck, X, ArrowRight, ShieldCheck, CalendarX2, CalendarPlus, Hash, RefreshCw,
} from "lucide-react";
import api from "@/lib/api";
import { categoryMeta, fmtDate, shortHash, severityClass, expiryMeta, notifyAlertsChanged } from "@/lib/format";

const TABS = [
  { id: "ACTIVE", label: "Active" },
  { id: "FRAUD", label: "Fraud Alerts" },
  { id: "RENEWAL", label: "Renewals" },
  { id: "DISMISSED", label: "Dismissed" },
];

function AlertCard({ a, onRead, onDismiss }) {
  const fraud = a.type === "FRAUD";
  const Icon = fraud ? ShieldAlert : CalendarClock;
  const unread = !a.read_at && a.status === "ACTIVE";
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
      data-testid={`alert-card-${a.type.toLowerCase()}`} className={`card-v p-5 border ${severityClass(a.severity)} ${unread ? "ring-1 ring-inset ring-white/5" : ""}`}>
      <div className="flex items-start gap-4">
        <div className={`h-11 w-11 rounded-xl grid place-items-center shrink-0 ${fraud ? "bg-rose-500/15" : "bg-amber-500/15"}`}>
          <Icon className={`h-5 w-5 ${fraud ? "text-rose-400" : "text-amber-400"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${fraud ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300"}`}>{fraud ? "Fraud alert" : "Renewal"}</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">{a.severity}</span>
            {unread && <span className="h-2 w-2 rounded-full bg-emerald-400" data-testid="alert-unread-dot" />}
            <span className="ml-auto text-xs text-slate-500">{fmtDate(a.created_at)}</span>
          </div>
          <h3 className="font-display font-bold mt-1.5" data-testid="alert-title">{a.title}</h3>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">{a.message}</p>
          {fraud && (
            <div className="mt-3 grid sm:grid-cols-2 gap-2 text-xs">
              <div className="hash-chip rounded-lg px-3 py-2 text-slate-400 flex items-center gap-2"><Hash className="h-3 w-3 text-emerald-400 shrink-0" /> On-chain: <span className="text-slate-200 font-mono truncate">{shortHash(a.meta.stored_hash, 10)}</span></div>
              <div className="hash-chip rounded-lg px-3 py-2 text-slate-400 flex items-center gap-2"><Hash className="h-3 w-3 text-rose-400 shrink-0" /> Current: <span className="text-rose-300 font-mono truncate">{a.meta.current_hash ? shortHash(a.meta.current_hash, 10) : "unavailable"}</span></div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link to={`/policy/${a.policy_id}`} data-testid="alert-view-policy-link" className="text-sm text-emerald-400 hover:underline inline-flex items-center gap-1">View policy <ArrowRight className="h-3.5 w-3.5" /></Link>
            {!fraud && <Link to={`/renewals/${a.policy_id}`} data-testid="alert-compare-renewal-link" className="text-sm text-amber-300 hover:underline inline-flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" /> Compare renewal quote</Link>}
            {a.status === "ACTIVE" && (
              <>
                {unread && <button onClick={() => onRead(a)} data-testid="alert-mark-read-button" className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:border-emerald-500/40 text-slate-300 inline-flex items-center gap-1"><CheckCheck className="h-3.5 w-3.5" /> Mark read</button>}
                <button onClick={() => onDismiss(a)} data-testid="alert-dismiss-button" className={`text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:border-rose-500/40 text-slate-400 inline-flex items-center gap-1 ${unread ? "" : "ml-auto"}`}><X className="h-3.5 w-3.5" /> Dismiss</button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function RenewalRow({ r }) {
  const meta = categoryMeta(r.category);
  const em = expiryMeta(r.days_left);
  const pct = r.days_left < 0 ? 100 : Math.max(4, Math.min(100, 100 - (r.days_left / 365) * 100));
  return (
    <Link to={`/policy/${r.id}`} data-testid="renewal-row" className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-emerald-500/30 transition-all">
      <div className="h-10 w-10 rounded-lg grid place-items-center shrink-0" style={{ background: `${meta.color}1f` }}><meta.icon className="h-5 w-5" style={{ color: meta.color }} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold truncate">{r.policy_name}</div>
          <span className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${em.cls}`} data-testid="renewal-days-badge">{em.label}</span>
        </div>
        <div className="text-xs text-slate-500 mt-0.5 flex items-center justify-between gap-2"><span>{meta.label} · Ends {fmtDate(r.policy_end_date)}</span><Link to={`/renewals/${r.id}`} onClick={(e) => e.stopPropagation()} data-testid="renewal-row-compare-link" className="text-amber-300 hover:underline inline-flex items-center gap-1 shrink-0"><RefreshCw className="h-3 w-3" /> Compare quote</Link></div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: em.color }} /></div>
      </div>
    </Link>
  );
}

export default function Alerts() {
  const [tab, setTab] = useState("ACTIVE");
  const [alerts, setAlerts] = useState([]);
  const [counts, setCounts] = useState({ active: 0, unread: 0, fraud: 0, renewal: 0 });
  const [renewals, setRenewals] = useState({ upcoming: [], missing_dates: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const status = tab === "DISMISSED" ? "DISMISSED" : "ACTIVE";
    const [a, r] = await Promise.all([api.get("/alerts", { params: { status } }), api.get("/renewals")]);
    setAlerts(a.data.alerts); setCounts(a.data.counts); setRenewals(r.data);
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const visible = alerts.filter((a) => (tab === "FRAUD" || tab === "RENEWAL") ? a.type === tab : true);

  const onRead = async (a) => {
    const { data } = await api.post(`/alerts/${a.id}/read`);
    setAlerts((xs) => xs.map((x) => (x.id === a.id ? data : x)));
    setCounts((c) => ({ ...c, unread: Math.max(0, c.unread - 1) }));
    notifyAlertsChanged();
  };
  const onDismiss = async (a) => {
    await api.post(`/alerts/${a.id}/dismiss`);
    setAlerts((xs) => xs.filter((x) => x.id !== a.id));
    setCounts((c) => ({ ...c, active: c.active - 1, unread: a.read_at ? c.unread : Math.max(0, c.unread - 1), [a.type.toLowerCase()]: c[a.type.toLowerCase()] - 1 }));
    toast.success("Alert dismissed");
    notifyAlertsChanged();
  };
  const readAll = async () => {
    await api.post("/alerts/read-all");
    setAlerts((xs) => xs.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
    setCounts((c) => ({ ...c, unread: 0 }));
    notifyAlertsChanged();
  };

  if (loading) return <div className="grid place-items-center h-96"><Loader2 className="h-7 w-7 animate-spin text-emerald-400" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-1">Stay Protected</div>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-2"><Bell className="h-7 w-7 text-emerald-400" /> Alerts & Renewals</h1>
          <p className="text-slate-400 mt-1">Fraud alerts fire the moment a document hash stops matching its on-chain record. Renewal reminders keep you covered.</p>
        </div>
        {counts.unread > 0 && (
          <button onClick={readAll} data-testid="alerts-read-all-button" className="self-start px-4 py-2.5 rounded-xl border border-slate-700 hover:border-emerald-500/40 text-sm font-medium inline-flex items-center gap-2"><CheckCheck className="h-4 w-4 text-emerald-400" /> Mark all read</button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className={`card-v p-6 ${counts.fraud ? "!border-rose-500/40" : ""}`} data-testid="alerts-fraud-stat">
          <div className="flex items-center gap-2 text-sm text-slate-400"><ShieldAlert className={`h-4 w-4 ${counts.fraud ? "text-rose-400" : "text-slate-500"}`} /> Fraud alerts</div>
          <div className={`font-display text-3xl font-extrabold mt-2 ${counts.fraud ? "text-rose-400" : ""}`}>{counts.fraud}</div>
          <div className="text-xs text-slate-500 mt-1">{counts.fraud ? "Hash mismatch detected" : "All document hashes match on-chain"}</div>
        </div>
        <div className={`card-v p-6 ${counts.renewal ? "!border-amber-500/40" : ""}`} data-testid="alerts-renewal-stat">
          <div className="flex items-center gap-2 text-sm text-slate-400"><CalendarClock className={`h-4 w-4 ${counts.renewal ? "text-amber-400" : "text-slate-500"}`} /> Renewals due</div>
          <div className={`font-display text-3xl font-extrabold mt-2 ${counts.renewal ? "text-amber-400" : ""}`}>{counts.renewal}</div>
          <div className="text-xs text-slate-500 mt-1">Reminders at 30 / 15 / 7 days before expiry</div>
        </div>
        <div className="card-v p-6" data-testid="alerts-tracked-stat">
          <div className="flex items-center gap-2 text-sm text-slate-400"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Policies tracked</div>
          <div className="font-display text-3xl font-extrabold mt-2">{renewals.upcoming.length + renewals.missing_dates.length}</div>
          <div className="text-xs text-slate-500 mt-1">{renewals.missing_dates.length} without an expiry date</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} data-testid={`alerts-tab-${t.id.toLowerCase()}`}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === t.id ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400 hover:text-slate-200 bg-slate-900/40"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <AnimatePresence mode="popLayout">
            {visible.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-v p-12 text-center" data-testid="alerts-empty-state">
                <ShieldCheck className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
                <h3 className="font-display text-xl font-bold mb-2">{tab === "DISMISSED" ? "No dismissed alerts" : "No alerts yet"}</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                  {tab === "FRAUD" ? "Every stored document still matches its on-chain SHA-256 record."
                    : tab === "RENEWAL" ? "No policies are within 30 days of expiry. Add expiry dates to your policies to get reminders."
                    : tab === "DISMISSED" ? "Alerts you dismiss will appear here."
                    : "Your documents are intact and no renewals are due. We re-check every time you open VeriTrust AI."}
                </p>
              </motion.div>
            ) : visible.map((a) => <AlertCard key={a.id} a={a} onRead={onRead} onDismiss={onDismiss} />)}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="card-v p-6" data-testid="renewal-timeline">
            <h3 className="font-display text-lg font-bold mb-1 flex items-center gap-2"><CalendarClock className="h-5 w-5 text-amber-400" /> Renewal Timeline</h3>
            <p className="text-xs text-slate-500 mb-4">Sorted by soonest expiry, based on each policy's own end date.</p>
            {renewals.upcoming.length === 0 ? (
              <div className="text-center py-8" data-testid="renewal-empty-state">
                <CalendarX2 className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No expiry dates recorded yet.</p>
                <p className="text-xs text-slate-500 mt-1">Open a policy and set its start / end date to start tracking renewals.</p>
              </div>
            ) : (
              <div className="space-y-3">{renewals.upcoming.map((r) => <RenewalRow key={r.id} r={r} />)}</div>
            )}
          </div>

          {renewals.missing_dates.length > 0 && (
            <div className="card-v p-6" data-testid="renewal-missing-dates">
              <h3 className="font-display font-bold mb-1 flex items-center gap-2"><CalendarPlus className="h-4 w-4 text-blue-400" /> Needs an expiry date</h3>
              <p className="text-xs text-slate-500 mb-3">The document didn't state an end date. Add one to get reminders.</p>
              <div className="space-y-2">
                {renewals.missing_dates.map((p) => (
                  <Link key={p.id} to={`/policy/${p.id}`} data-testid="renewal-missing-row" className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-slate-800 hover:border-blue-500/30 text-sm">
                    <span className="truncate">{p.policy_name}</span><span className="text-blue-400 text-xs inline-flex items-center gap-1 shrink-0">Set date <ArrowRight className="h-3 w-3" /></span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
