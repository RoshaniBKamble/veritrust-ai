import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadialBarChart, RadialBar,
} from "recharts";
import { FileText, ShieldCheck, Activity, UploadCloud, ArrowRight, Loader2, Sparkles, ShieldAlert, CalendarClock } from "lucide-react";
import api from "@/lib/api";
import LedgerBadge from "@/components/LedgerBadge";
import { useAuth } from "@/context/AuthContext";
import { categoryMeta, riskColor, riskBadgeClass, fmtDate } from "@/lib/format";

const CAT_COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899"];

function AlertBanner({ alerts }) {
  const fraud = alerts.filter((a) => a.type === "FRAUD");
  const renewal = alerts.filter((a) => a.type === "RENEWAL");
  if (!fraud.length && !renewal.length) return null;
  return (
    <div className="space-y-3">
      {fraud.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} data-testid="dashboard-fraud-banner"
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-rose-500/20 grid place-items-center shrink-0"><ShieldAlert className="h-6 w-6 text-rose-400" /></div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-rose-300">{fraud.length === 1 ? "Fraud alert: document hash mismatch" : `${fraud.length} fraud alerts: document hash mismatches`}</div>
            <p className="text-sm text-rose-200/80 mt-0.5 truncate">{fraud.map((a) => a.meta?.policy_name).filter(Boolean).join(", ")} no longer match{fraud.length === 1 ? "es" : ""} the on-chain record.</p>
          </div>
          <Link to="/alerts" data-testid="dashboard-fraud-banner-link" className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-sm font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto">Review <ArrowRight className="h-4 w-4" /></Link>
        </motion.div>
      )}
      {renewal.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} data-testid="dashboard-renewal-banner"
          className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-amber-500/20 grid place-items-center shrink-0"><CalendarClock className="h-6 w-6 text-amber-400" /></div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-amber-300">{renewal.length === 1 ? renewal[0].title : `${renewal.length} policies need renewal attention`}</div>
            <p className="text-sm text-amber-200/80 mt-0.5 truncate">{renewal.length === 1 ? renewal[0].message : renewal.map((a) => a.title).join(" · ")}</p>
          </div>
          <Link to="/alerts" data-testid="dashboard-renewal-banner-link" className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-sm font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto">View renewals <ArrowRight className="h-4 w-4" /></Link>
        </motion.div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, color, testid }) {
  return (
    <motion.div data-testid={testid} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-v p-6">
      <div className="flex items-center justify-between">
        <div className="h-11 w-11 rounded-xl grid place-items-center" style={{ background: `${color}1f`, border: `1px solid ${color}44` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
      <div className="mt-4 font-display text-3xl font-extrabold">{value}</div>
      <div className="text-sm text-slate-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/policies/dashboard"), api.get("/alerts", { params: { status: "ACTIVE" } })])
      .then(([d, a]) => { setData(d.data); setAlerts(a.data.alerts); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="grid place-items-center h-96"><Loader2 className="h-7 w-7 animate-spin text-emerald-400" /></div>;

  const empty = data.total_policies === 0;
  const riskData = (data.risk_level_distribution || []).map((d) => ({
    ...d, fill: d.name === "Low" ? "#10B981" : d.name === "Medium" ? "#F59E0B" : "#EF4444",
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-1">Command Center</div>
          <h1 className="font-display text-3xl font-extrabold">Welcome back, {user?.full_name?.split(" ")[0]} 👋</h1>
          <p className="text-slate-400 mt-1">Here's an overview of your insurance intelligence.</p>
        </div>
        <Link to="/upload" data-testid="dashboard-upload-cta" className="btn-glow px-5 py-3 rounded-xl font-semibold text-slate-950 flex items-center gap-2 self-start">
          <UploadCloud className="h-5 w-5" /> Upload Policy
        </Link>
      </div>

      <AlertBanner alerts={alerts} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Stat testid="dashboard-total-policies-stat" icon={FileText} label="Total Policies" value={data.total_policies} color="#3B82F6" />
        <Stat testid="dashboard-verified-policies-stat" icon={ShieldCheck} label="Verified Policies" value={data.verified_policies} sub="Blockchain anchored" color="#10B981" />
        <Stat testid="dashboard-avg-risk-stat" icon={Activity} label="Average Risk Score" value={`${data.average_risk_score}/100`} color={riskColor(data.average_risk_score)} />
        <Stat testid="dashboard-categories-stat" icon={Sparkles} label="Policy Categories" value={(data.category_distribution || []).length} color="#8B5CF6" />
      </div>

      {empty ? (
        <div className="card-v p-12 text-center">
          <UploadCloud className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
          <h3 className="font-display text-xl font-bold mb-2">No policies yet</h3>
          <p className="text-slate-400 mb-6">Upload your first insurance policy to see AI analysis, risk scores and blockchain verification.</p>
          <Link to="/upload" className="btn-glow inline-flex px-5 py-3 rounded-xl font-semibold text-slate-950 items-center gap-2">Upload your first policy <ArrowRight className="h-4 w-4" /></Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="card-v p-6" data-testid="dashboard-recent-policies-list">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-bold">Recent Policies</h3>
                <Link to="/policies" className="text-sm text-emerald-400 hover:underline flex items-center gap-1">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
              <div className="space-y-3">
                {data.recent_policies.map((p) => {
                  const meta = categoryMeta(p.category);
                  return (
                    <Link key={p.id} to={`/policy/${p.id}`} data-testid="dashboard-policy-row-item"
                      className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-emerald-500/30 transition-all">
                      <div className="h-10 w-10 rounded-lg grid place-items-center shrink-0" style={{ background: `${meta.color}1f` }}>
                        <meta.icon className="h-5 w-5" style={{ color: meta.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{p.policy_name}</div>
                        <div className="text-xs text-slate-500">{meta.label} · {fmtDate(p.upload_date)}</div>
                      </div>
                      {p.risk_level && <span className={`text-xs px-2.5 py-1 rounded-full border ${riskBadgeClass(p.risk_level)}`}>{p.risk_score} · {p.risk_level}</span>}
                      {p.verification_status === "VERIFIED" ? <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" /> : p.verification_status === "DOCUMENT_MODIFIED" ? <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0" /> : null}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="card-v p-6" data-testid="dashboard-risk-chart">
              <h3 className="font-display text-lg font-bold mb-5">Risk Level Distribution</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={riskData}>
                  <XAxis dataKey="name" stroke="#64748B" fontSize={12} />
                  <YAxis stroke="#64748B" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#0C1427", border: "1px solid #1E293B", borderRadius: 12 }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {riskData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="card-v p-6">
              <h3 className="font-display text-lg font-bold mb-4">Category Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data.category_distribution} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                    {(data.category_distribution || []).map((d, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0C1427", border: "1px solid #1E293B", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {(data.category_distribution || []).map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-400 capitalize"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />{d.name}</span>
                    <span className="text-slate-300">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ledger-card p-6">
              <div className="flex items-center justify-between gap-2 mb-3"><div className="flex items-center gap-2"><span className="pulse-dot" /><span className="text-sm font-semibold text-emerald-300">Verification Status</span></div><LedgerBadge mode={data.ledger_mode} /></div>
              <div className="font-display text-4xl font-extrabold">{data.verified_policies}<span className="text-slate-500 text-2xl">/{data.total_policies}</span></div>
              <p className="text-sm text-slate-400 mt-1">policies with SHA-256 proof recorded on the {data.ledger_mode === "live" ? "Polygon Amoy" : "development"} ledger.</p>
              <Link to="/verify" className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:underline">Open Verification Center <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
