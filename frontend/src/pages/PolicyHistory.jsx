import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Search, Loader2, ShieldCheck, Trash2, UploadCloud, FileText } from "lucide-react";
import api from "@/lib/api";
import { CATEGORIES, categoryMeta, riskBadgeClass, fmtDate } from "@/lib/format";

export default function PolicyHistory() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [level, setLevel] = useState("all");
  const [verif, setVerif] = useState("all");

  const load = () => api.get("/policies").then((r) => setPolicies(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const del = async (id, e) => {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm("Delete this policy and its analysis?")) return;
    await api.delete(`/policies/${id}`);
    setPolicies((ps) => ps.filter((p) => p.id !== id));
    toast.success("Policy deleted");
  };

  const filtered = useMemo(() => policies.filter((p) => {
    if (q && !p.policy_name.toLowerCase().includes(q.toLowerCase())) return false;
    if (cat !== "all" && p.category !== cat) return false;
    if (level !== "all" && p.risk_level !== level) return false;
    if (verif !== "all" && p.verification_status !== verif) return false;
    return true;
  }), [policies, q, cat, level, verif]);

  if (loading) return <div className="grid place-items-center h-96"><Loader2 className="h-7 w-7 animate-spin text-emerald-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-1">Your Records</div>
          <h1 className="font-display text-3xl font-extrabold">Policy History</h1>
          <p className="text-slate-400 mt-1">{policies.length} {policies.length === 1 ? "policy" : "policies"} analyzed & verified.</p>
        </div>
        <Link to="/upload" className="btn-glow px-5 py-3 rounded-xl font-semibold text-slate-950 flex items-center gap-2 self-start"><UploadCloud className="h-5 w-5" /> Upload Policy</Link>
      </div>

      <div className="card-v p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="history-search-input" placeholder="Search policies…"
            className="w-full bg-slate-900/60 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-emerald-500/50" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} data-testid="history-filter-category" className="bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} data-testid="history-filter-risk" className="bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none">
          <option value="all">All risk levels</option>
          <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
        </select>
        <select value={verif} onChange={(e) => setVerif(e.target.value)} data-testid="history-filter-verification" className="bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none">
          <option value="all">All statuses</option>
          <option value="VERIFIED">Verified</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card-v p-12 text-center">
          <FileText className="h-10 w-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No policies match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="history-policy-grid">
          {filtered.map((p, i) => {
            const meta = categoryMeta(p.category);
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link to={`/policy/${p.id}`} data-testid="history-policy-card" className="card-v p-5 block h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-10 w-10 rounded-lg grid place-items-center" style={{ background: `${meta.color}1f` }}><meta.icon className="h-5 w-5" style={{ color: meta.color }} /></div>
                    <button onClick={(e) => del(p.id, e)} data-testid="history-delete-button" className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="font-semibold truncate">{p.policy_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{meta.label} · {fmtDate(p.upload_date)}</div>
                  <div className="mt-4 flex items-center justify-between">
                    {p.risk_level && <span className={`text-xs px-2.5 py-1 rounded-full border ${riskBadgeClass(p.risk_level)}`}>{p.risk_score}/100 · {p.risk_level}</span>}
                    {p.verification_status === "VERIFIED" && <span className="text-xs text-emerald-400 flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> Verified</span>}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
