import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  RefreshCw, Loader2, UploadCloud, CalendarClock, ArrowRight, ArrowLeftRight, TrendingUp, TrendingDown, Minus,
  Info, FileText, Link2, CheckCircle2, AlertTriangle, XCircle, Sparkles,
} from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { categoryMeta, fmtDate, expiryMeta, riskBadgeClass } from "@/lib/format";

const VERDICT = {
  RENEW: { label: "Renew", icon: CheckCircle2, cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  RENEW_WITH_CAUTION: { label: "Renew with Caution", icon: AlertTriangle, cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  LOOK_ELSEWHERE: { label: "Look Elsewhere", icon: XCircle, cls: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
};

function Countdown({ p }) {
  const em = expiryMeta(p.days_to_expiry);
  if (!em) return <span className="text-xs text-slate-500" data-testid="renewal-countdown-missing">No expiry date set · <Link to={`/policy/${p.id}`} className="text-blue-400 hover:underline">add one</Link></span>;
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${em.cls}`} data-testid="renewal-countdown">
      <CalendarClock className="h-3 w-3" /> {p.days_to_expiry < 0 ? `Expired ${fmtDate(p.policy_end_date)}` : p.days_to_expiry === 0 ? "Expires today" : `${p.days_to_expiry} days left · ${fmtDate(p.policy_end_date)}`}
    </span>
  );
}

function ChangeList({ title, items, icon: Icon, color, testid }) {
  return (
    <div className="card-v p-5" data-testid={testid}>
      <div className="flex items-center gap-2 mb-3"><Icon className={`h-4 w-4 ${color}`} /><span className="font-semibold text-sm">{title}</span><span className="ml-auto text-xs text-slate-500">{items.length}</span></div>
      {items.length ? <ul className="space-y-2">{items.map((x, i) => <li key={i} className="text-sm text-slate-300 flex gap-2"><span className={color}>•</span>{x}</li>)}</ul>
        : <p className="text-xs text-slate-500">Nothing here.</p>}
    </div>
  );
}

function ComparisonResult({ c }) {
  const v = VERDICT[c.verdict] || VERDICT.RENEW_WITH_CAUTION;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="renewal-comparison-result">
      <div className={`rounded-2xl border p-6 ${v.cls}`} data-testid={`renewal-verdict-${c.verdict.toLowerCase()}`}>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-slate-950/40 grid place-items-center shrink-0"><v.icon className="h-7 w-7" /></div>
          <div className="flex-1">
            <div className="eyebrow !text-current opacity-70">AI Guidance</div>
            <div className="font-display text-2xl font-extrabold" data-testid="renewal-verdict-label">{v.label}</div>
            <p className="text-sm mt-1 opacity-90" data-testid="renewal-verdict-reason">{c.reason}</p>
          </div>
          <div className="text-right shrink-0"><Countdown p={c.original} /></div>
        </div>
        {c.summary && <p className="text-sm mt-4 pt-4 border-t border-current/20 opacity-80">{c.summary}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="renewal-what-changed">
        <ChangeList title="Improved" items={c.changes.improved} icon={TrendingUp} color="text-emerald-400" testid="renewal-changes-improved" />
        <ChangeList title="Worse" items={c.changes.worse} icon={TrendingDown} color="text-rose-400" testid="renewal-changes-worse" />
        <ChangeList title="Same" items={c.changes.same} icon={Minus} color="text-slate-400" testid="renewal-changes-same" />
      </div>

      <div className="card-v p-6 overflow-x-auto" data-testid="renewal-compare-table">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-800">
              <th className="py-3 pr-4 font-medium">Factor</th>
              <th className="py-3 px-4 font-medium"><div className="text-slate-300">{c.original.policy_name}</div><div className="text-[10px] uppercase tracking-wider text-slate-500">Current · expiring</div></th>
              <th className="py-3 px-4 font-medium"><div className="text-slate-300">{c.quote.policy_name}</div><div className="text-[10px] uppercase tracking-wider text-emerald-400">Renewal quote</div></th>
            </tr>
          </thead>
          <tbody>
            {c.rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-800/60 align-top">
                <td className="py-3 pr-4 text-slate-400 whitespace-nowrap">{row.factor}</td>
                <td className={`py-3 px-4 ${row.better === "ORIGINAL" ? "text-emerald-300" : "text-slate-300"}`}>{row.original}{row.factor === "Risk Score" && c.original.risk_score != null && <span className={`ml-2 text-xs px-2 py-0.5 rounded-full border ${riskBadgeClass(c.original.risk_level)}`}>{c.original.risk_score}/100</span>}</td>
                <td className={`py-3 px-4 ${row.better === "QUOTE" ? "text-emerald-300" : "text-slate-300"}`}>{row.quote}{row.factor === "Risk Score" && c.quote.risk_score != null && <span className={`ml-2 text-xs px-2 py-0.5 rounded-full border ${riskBadgeClass(c.quote.risk_level)}`}>{c.quote.risk_score}/100</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-slate-500 mt-4 flex items-start gap-1.5" data-testid="renewal-disclaimer"><Info className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {c.disclaimer} Compared {new Date(c.created_at).toLocaleString()}.</p>
      </div>
    </motion.div>
  );
}

export default function RenewalCompare() {
  const { originalId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [allPolicies, setAllPolicies] = useState([]);
  const [selected, setSelected] = useState(originalId || "");
  const [quoteId, setQuoteId] = useState(params.get("quote") || "");
  const [linkId, setLinkId] = useState("");
  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [o, p] = await Promise.all([api.get("/renewals/overview"), api.get("/policies")]);
    setOverview(o.data); setAllPolicies(p.data); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const original = overview?.policies.find((p) => p.id === selected);

  useEffect(() => {
    if (!original) return;
    if (!quoteId && original.candidates[0]) setQuoteId(original.latest_comparison?.quote_id || original.candidates[0].id);
  }, [original, quoteId]);

  useEffect(() => {
    setComparison(null);
    if (!selected || !quoteId) return;
    api.get(`/renewals/comparison/${selected}`, { params: { quote_id: quoteId } }).then((r) => setComparison(r.data)).catch(() => {});
  }, [selected, quoteId]);

  const choose = (id) => { setSelected(id); setQuoteId(""); navigate(id ? `/renewals/${id}` : "/renewals", { replace: true }); };

  const link = async () => {
    if (!linkId) return;
    try {
      await api.post(`/renewals/${selected}/link`, { quote_id: linkId });
      toast.success("Linked as renewal quote"); setLinkId(""); await load(); setQuoteId(linkId);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail) || "Could not link."); }
  };

  const run = async () => {
    if (!selected || !quoteId) return toast.error("Choose the expiring policy and a renewal quote.");
    setComparing(true);
    try {
      const { data } = await api.post("/renewals/compare", { original_id: selected, quote_id: quoteId });
      setComparison(data); toast.success("Comparison ready"); load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail) || "Comparison failed."); }
    finally { setComparing(false); }
  };

  if (loading) return <div className="grid place-items-center h-96"><Loader2 className="h-7 w-7 animate-spin text-emerald-400" /></div>;

  const empty = overview.policies.length === 0;
  const linkable = allPolicies.filter((p) => p.id !== selected && !p.renewal_of_policy_id && !(original?.candidates || []).some((c) => c.id === p.id));

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow mb-1">Before the Deadline</div>
        <h1 className="font-display text-3xl font-extrabold flex items-center gap-2"><RefreshCw className="h-7 w-7 text-emerald-400" /> Renewal Comparison</h1>
        <p className="text-slate-400 mt-1">Put your expiring policy next to the renewal quote you were offered and see exactly what changed — in simple words.</p>
      </div>

      {empty ? (
        <div className="card-v p-12 text-center" data-testid="renewal-compare-empty">
          <FileText className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
          <h3 className="font-display text-xl font-bold mb-2">No policies to compare yet</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">Upload your current policy first. When your insurer sends a renewal quote, upload that too and we'll compare them side by side.</p>
          <Link to="/upload" className="btn-glow inline-flex px-5 py-3 rounded-xl font-semibold text-slate-950 items-center gap-2"><UploadCloud className="h-4 w-4" /> Upload a policy</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 card-v p-6 space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">1. Expiring policy</label>
                <select value={selected} onChange={(e) => choose(e.target.value)} data-testid="renewal-original-select"
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500/50">
                  <option value="">Select your current policy…</option>
                  {overview.policies.map((p) => <option key={p.id} value={p.id}>{p.policy_name}{p.days_to_expiry != null ? ` · ${p.days_to_expiry < 0 ? "expired" : `${p.days_to_expiry}d left`}` : ""}</option>)}
                </select>
                {original && <div className="mt-2"><Countdown p={original} /></div>}
              </div>

              {original && (
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">2. Renewal quote</label>
                  {original.candidates.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-700 p-4 text-center" data-testid="renewal-no-candidates">
                      <p className="text-sm text-slate-400">No renewal quote linked to this policy yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2" data-testid="renewal-candidate-list">
                      {original.candidates.map((q) => (
                        <button key={q.id} onClick={() => setQuoteId(q.id)} data-testid="renewal-candidate-item"
                          className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-all ${quoteId === q.id ? "border-emerald-500/50 bg-emerald-500/5" : "border-slate-800 bg-slate-900/40 hover:border-slate-600"}`}>
                          <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                          <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{q.policy_name}</div><div className="text-xs text-slate-500">Uploaded {fmtDate(q.upload_date)}{q.risk_score != null ? ` · Risk ${q.risk_score}/100` : ""}</div></div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2 mt-3">
                    <Link to={`/upload?renewal_of=${original.id}`} data-testid="renewal-upload-quote-link"
                      className="flex-1 px-4 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-sm font-medium text-emerald-300 inline-flex items-center justify-center gap-2"><UploadCloud className="h-4 w-4" /> Upload renewal quote</Link>
                    {linkable.length > 0 && (
                      <div className="flex-1 flex gap-2">
                        <select value={linkId} onChange={(e) => setLinkId(e.target.value)} data-testid="renewal-link-select" className="flex-1 bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2.5 text-xs outline-none">
                          <option value="">Link an uploaded policy…</option>
                          {linkable.map((p) => <option key={p.id} value={p.id}>{p.policy_name}</option>)}
                        </select>
                        <button onClick={link} disabled={!linkId} data-testid="renewal-link-button" className="px-3 rounded-xl border border-slate-700 text-slate-300 disabled:opacity-40"><Link2 className="h-4 w-4" /></button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button onClick={run} disabled={comparing || !selected || !quoteId} data-testid="renewal-compare-button"
                className="btn-glow w-full py-3 rounded-xl font-semibold text-slate-950 flex items-center justify-center gap-2 disabled:opacity-50">
                {comparing ? <><Loader2 className="h-5 w-5 animate-spin" /> Comparing with AI…</> : <><ArrowLeftRight className="h-5 w-5" /> {comparison ? "Re-run comparison" : "Compare side by side"}</>}
              </button>
            </div>

            <div className="lg:col-span-7 card-v p-6" data-testid="renewal-policy-list">
              <h3 className="font-display font-bold mb-1 flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-400" /> Your policies by expiry</h3>
              <p className="text-xs text-slate-500 mb-4">Only your own uploaded policies appear here, sorted by the soonest deadline.</p>
              <div className="space-y-2">
                {overview.policies.map((p) => {
                  const meta = categoryMeta(p.category);
                  return (
                    <button key={p.id} onClick={() => choose(p.id)} data-testid="renewal-policy-row"
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${selected === p.id ? "border-emerald-500/50 bg-emerald-500/5" : "border-slate-800 bg-slate-900/40 hover:border-slate-600"}`}>
                      <div className="h-9 w-9 rounded-lg grid place-items-center shrink-0" style={{ background: `${meta.color}1f` }}><meta.icon className="h-4 w-4" style={{ color: meta.color }} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{p.policy_name}</div>
                        <div className="text-xs text-slate-500">{p.candidates.length} quote{p.candidates.length === 1 ? "" : "s"} linked{p.latest_comparison ? ` · last verdict: ${VERDICT[p.latest_comparison.verdict]?.label}` : ""}</div>
                      </div>
                      <Countdown p={p} />
                      <ArrowRight className="h-4 w-4 text-slate-600 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {comparison ? <ComparisonResult c={comparison} /> : original && quoteId && (
            <div className="card-v p-8 text-center" data-testid="renewal-not-compared-yet">
              <ArrowLeftRight className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Ready — press <span className="text-emerald-300">Compare side by side</span> to see what changed.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
