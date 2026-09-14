import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GitCompare, Loader2, Trophy, ArrowRight } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { categoryMeta, riskBadgeClass } from "@/lib/format";

export default function PolicyCompare() {
  const [policies, setPolicies] = useState([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { api.get("/policies").then((r) => setPolicies(r.data)); }, []);

  const run = async () => {
    if (!a || !b) return toast.error("Select two policies to compare.");
    if (a === b) return toast.error("Please select two different policies.");
    setLoading(true); setResult(null);
    try {
      const { data } = await api.post("/policies/compare", { policy_a_id: a, policy_b_id: b });
      setResult(data);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Comparison failed.");
    } finally { setLoading(false); }
  };

  const Selector = ({ value, onChange, label, testid }) => (
    <div className="flex-1">
      <label className="text-sm text-slate-400 mb-2 block">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid}
        className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500/50">
        <option value="">Select a policy…</option>
        {policies.map((p) => <option key={p.id} value={p.id}>{p.policy_name} ({categoryMeta(p.category).label})</option>)}
      </select>
    </div>
  );

  const c = result?.comparison;
  const winnerName = c?.winner === "A" ? result?.policy_a?.name : c?.winner === "B" ? result?.policy_b?.name : "Tie";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <div className="eyebrow mb-1">Side by Side</div>
        <h1 className="font-display text-3xl font-extrabold">Policy Comparison</h1>
        <p className="text-slate-400 mt-1">Compare two policies and get an AI recommendation on which is better for you.</p>
      </div>

      <div className="card-v p-6">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <Selector value={a} onChange={setA} label="Policy A" testid="compare-policy-select-a" />
          <div className="hidden md:grid place-items-center h-11 w-11 rounded-full bg-slate-800 shrink-0"><GitCompare className="h-5 w-5 text-emerald-400" /></div>
          <Selector value={b} onChange={setB} label="Policy B" testid="compare-policy-select-b" />
        </div>
        <button onClick={run} disabled={loading} data-testid="compare-execute-button"
          className="btn-glow mt-5 w-full py-3 rounded-xl font-semibold text-slate-950 flex items-center justify-center gap-2 disabled:opacity-60">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Compare Policies <ArrowRight className="h-4 w-4" /></>}
        </button>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="ledger-card p-6" data-testid="compare-winner-badge">
            <div className="flex items-center gap-2 mb-2"><Trophy className="h-5 w-5 text-amber-400" /><span className="font-display font-bold text-lg">AI Recommendation</span></div>
            <p className="text-slate-300">{c.recommendation}</p>
            {c.winner && c.winner !== "Tie" && <div className="mt-3 text-sm text-emerald-400">Recommended: <span className="font-semibold">{winnerName}</span></div>}
            {c.summary && <p className="text-sm text-slate-400 mt-3 pt-3 border-t border-slate-800">{c.summary}</p>}
          </div>

          <div className="card-v p-6 overflow-x-auto" data-testid="compare-table-diff">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-800">
                  <th className="py-3 pr-4 font-medium">Factor</th>
                  <th className="py-3 px-4 font-medium">{result.policy_a.name}</th>
                  <th className="py-3 px-4 font-medium">{result.policy_b.name}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-800/60">
                  <td className="py-3 pr-4 text-slate-400">Risk Score</td>
                  <td className="py-3 px-4"><span className={`text-xs px-2 py-1 rounded-full border ${riskBadgeClass(result.policy_a.risk_score <= 35 ? "Low" : result.policy_a.risk_score <= 69 ? "Medium" : "High")}`}>{result.policy_a.risk_score}/100</span></td>
                  <td className="py-3 px-4"><span className={`text-xs px-2 py-1 rounded-full border ${riskBadgeClass(result.policy_b.risk_score <= 35 ? "Low" : result.policy_b.risk_score <= 69 ? "Medium" : "High")}`}>{result.policy_b.risk_score}/100</span></td>
                </tr>
                {(c.rows || []).map((row, i) => (
                  <tr key={i} className="border-b border-slate-800/60">
                    <td className="py-3 pr-4 text-slate-400">{row.factor}</td>
                    <td className={`py-3 px-4 ${row.better === "A" ? "text-emerald-300" : "text-slate-300"}`}>{row.a}</td>
                    <td className={`py-3 px-4 ${row.better === "B" ? "text-emerald-300" : "text-slate-300"}`}>{row.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
