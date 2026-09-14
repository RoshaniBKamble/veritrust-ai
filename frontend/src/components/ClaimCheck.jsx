import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ClipboardCheck, Loader2, Quote, ListChecks, Footprints, Info, History, ChevronDown, ShieldQuestion } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { LANGUAGES } from "@/lib/format";

export const VERDICT_META = {
  LIKELY_COVERED: { label: "Likely Covered", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40", dot: "bg-emerald-400" },
  CONDITIONS_APPLY: { label: "Conditions Apply", cls: "bg-amber-500/10 text-amber-300 border-amber-500/40", dot: "bg-amber-400" },
  LIKELY_NOT_COVERED: { label: "Likely Not Covered", cls: "bg-rose-500/10 text-rose-300 border-rose-500/40", dot: "bg-rose-400" },
};

const EXAMPLES = ["Knee surgery next month", "Cataract operation for my father", "Car damaged in a flood", "Trip cancelled due to illness"];

function VerdictCard({ c, compact = false }) {
  const m = VERDICT_META[c.verdict] || VERDICT_META.CONDITIONS_APPLY;
  const [open, setOpen] = useState(!compact);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border ${m.cls.split(" ").slice(2).join(" ")} bg-slate-900/40 overflow-hidden`} data-testid={`claim-verdict-card-${c.verdict.toLowerCase()}`}>
      <button onClick={() => compact && setOpen((o) => !o)} className={`w-full text-left p-4 flex items-start gap-3 ${compact ? "hover:bg-slate-800/30" : "cursor-default"}`}>
        <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${m.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${m.cls}`} data-testid="claim-verdict-label">{m.label}</span>
            <span className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString()}</span>
          </div>
          <div className="text-sm text-slate-200 mt-2 font-medium">“{c.situation}”</div>
          <p className="text-sm text-slate-300 mt-1.5" data-testid="claim-verdict-reason">{c.reason}</p>
        </div>
        {compact && <ChevronDown className={`h-4 w-4 text-slate-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-4 border-t border-slate-800/60 pt-4">
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5"><Quote className="h-3.5 w-3.5 text-emerald-400" /> Exact policy clause{c.clauses.length !== 1 ? "s" : ""}</div>
                {c.clauses.length ? c.clauses.map((cl, i) => (
                  <div key={i} className="mb-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3" data-testid="claim-clause">
                    <p className="text-sm text-slate-200 italic leading-relaxed border-l-2 border-emerald-500/50 pl-3">{cl.clause}</p>
                    {cl.simple && <p className="text-xs text-slate-400 mt-2">💡 {cl.simple}</p>}
                  </div>
                )) : <p className="text-sm text-slate-500">The policy text does not contain a clause that directly addresses this.</p>}
              </div>
              {c.conditions.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5 text-amber-400" /> Conditions to meet</div>
                  <ul className="space-y-1.5">{c.conditions.map((x, i) => <li key={i} className="text-sm text-slate-300 flex gap-2" data-testid="claim-condition"><span className="text-amber-400">•</span>{x}</li>)}</ul>
                </div>
              )}
              {c.next_steps.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5"><Footprints className="h-3.5 w-3.5 text-blue-400" /> Next steps</div>
                  <ul className="space-y-1.5">{c.next_steps.map((x, i) => <li key={i} className="text-sm text-slate-300 flex gap-2"><span className="text-blue-400">→</span>{x}</li>)}</ul>
                </div>
              )}
              <p className="text-[11px] text-slate-500 flex items-start gap-1.5" data-testid="claim-disclaimer"><Info className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {c.disclaimer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ClaimCheck({ policyId, defaultLang = "en" }) {
  const [situation, setSituation] = useState("");
  const [lang, setLang] = useState(defaultLang);
  const [loading, setLoading] = useState(false);
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);

  const load = useCallback(() => {
    if (!policyId) return;
    api.get(`/ai/claim-checks/${policyId}`).then((r) => setHistory(r.data)).catch(() => setHistory([]));
  }, [policyId]);
  useEffect(() => { setLatest(null); load(); }, [load]);

  const run = async (text) => {
    const s = (text || situation).trim();
    if (s.length < 5) return toast.error("Describe your situation in a few words.");
    if (!policyId) return toast.error("Select a policy first.");
    setLoading(true);
    try {
      const { data } = await api.post(`/ai/claim-check/${policyId}`, { situation: s, language: lang });
      setLatest(data); setHistory((h) => [data, ...h]); setSituation("");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Claim check failed.");
    } finally { setLoading(false); }
  };

  const past = history.filter((h) => h.id !== latest?.id);

  return (
    <div className="space-y-5" data-testid="claim-check-panel">
      <div>
        <label className="text-sm text-slate-400 mb-2 block">Describe what happened or what you're planning</label>
        <textarea value={situation} onChange={(e) => setSituation(e.target.value)} rows={3} data-testid="claim-check-input"
          placeholder="e.g. I need knee surgery next month at a private hospital"
          className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500/50 resize-none" />
        <div className="flex flex-wrap gap-2 mt-2">
          {EXAMPLES.map((e) => <button key={e} onClick={() => setSituation(e)} data-testid="claim-check-example" className="text-xs px-2.5 py-1 rounded-full border border-slate-800 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/40">{e}</button>)}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex gap-1 bg-slate-900/60 rounded-lg p-1 border border-slate-800 w-fit">
          {LANGUAGES.map((l) => (
            <button key={l.code} onClick={() => setLang(l.code)} data-testid={`claim-check-lang-${l.code}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${lang === l.code ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`}>{l.native}</button>
          ))}
        </div>
        <button onClick={() => run()} disabled={loading} data-testid="claim-check-submit"
          className="btn-glow sm:ml-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-950 inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking your policy…</> : <><ClipboardCheck className="h-4 w-4" /> Can I claim for this?</>}
        </button>
      </div>

      {latest && <VerdictCard c={latest} />}

      <div>
        <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Your claim checks for this policy</div>
        {history.length === 0 && !latest ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center" data-testid="claim-history-empty">
            <ShieldQuestion className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No claim checks yet.</p>
            <p className="text-xs text-slate-500 mt-1">Describe a situation above to see whether this policy is likely to cover it.</p>
          </div>
        ) : past.length === 0 ? null : (
          <div className="space-y-2" data-testid="claim-history-list">{past.map((c) => <VerdictCard key={c.id} c={c} compact />)}</div>
        )}
      </div>
    </div>
  );
}
