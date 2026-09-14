import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2, Copy, ShieldCheck, Download, MessageSquareText, ArrowLeft, ExternalLink,
  CheckCircle2, XCircle, ChevronRight, FileText, AlertTriangle, Boxes, Hash, Link2,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import api, { API } from "@/lib/api";
import RiskGauge from "@/components/RiskGauge";
import VoicePlayer from "@/components/VoicePlayer";
import PolicyValidity from "@/components/PolicyValidity";
import LedgerBadge from "@/components/LedgerBadge";
import { categoryMeta, riskBadgeClass, riskColor, shortHash, fmtDate, LANGUAGES } from "@/lib/format";

function copy(text, label = "Copied") { navigator.clipboard.writeText(text); toast.success(`${label} to clipboard`); }

function ListBlock({ title, items, icon: Icon, empty = "None mentioned." }) {
  return (
    <div>
      <h4 className="font-display font-semibold text-base mb-3 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-emerald-400" />} {title}
      </h4>
      {items && items.length ? (
        <div className="space-y-2.5">
          {items.map((it, i) => {
            const head = typeof it === "object" ? (it.item || it.term) : it;
            const simple = typeof it === "object" ? it.simple : "";
            return (
              <div key={i} className="p-3 rounded-lg bg-slate-900/40 border border-slate-800">
                <div className="text-sm font-medium text-slate-200">{head}</div>
                {simple && <div className="text-sm text-slate-400 mt-1">💡 {simple}</div>}
              </div>
            );
          })}
        </div>
      ) : <p className="text-sm text-slate-500">{empty}</p>}
    </div>
  );
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "coverage", label: "Coverage" },
  { id: "exclusions", label: "Exclusions" },
  { id: "waiting", label: "Waiting Period" },
  { id: "claims", label: "Claims" },
];

export default function PolicyAnalysis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState("en");
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    api.get(`/policies/${id}`).then((r) => setP(r.data)).catch(() => { toast.error("Policy not found"); navigate("/policies"); }).finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return <div className="grid place-items-center h-96"><Loader2 className="h-7 w-7 animate-spin text-emerald-400" /></div>;
  if (!p) return null;

  const meta = categoryMeta(p.category);
  const a = p.analysis || {};
  const r = p.risk || {};
  const v = p.verification || {};
  const explanation = { en: a.simple_explanation_en, hi: a.simple_explanation_hi, mr: a.simple_explanation_mr }[lang] || a.simple_explanation_en;
  const verified = v.status === "VERIFIED";

  const downloadReport = async () => {
    const token = localStorage.getItem("veritrust_token");
    const res = await fetch(`${API}/report/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return toast.error("Could not generate report");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `VeriTrust_${p.policy_name}.pdf`; link.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  return (
    <div className="space-y-6">
      <Link to="/policies" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-400"><ArrowLeft className="h-4 w-4" /> Back to history</Link>

      {!verified && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} data-testid="policy-fraud-banner"
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 flex items-start gap-4">
          <AlertTriangle className="h-6 w-6 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-display font-bold text-rose-300">Fraud alert — document hash mismatch</div>
            <p className="text-sm text-rose-200/80 mt-1">This document's SHA-256 fingerprint no longer matches the record anchored on-chain. Treat its contents as untrusted until you confirm with your insurer.</p>
          </div>
          <Link to="/alerts" className="text-sm text-rose-300 hover:underline shrink-0">View alerts</Link>
        </motion.div>
      )}

      {/* Header */}
      <div className="card-v p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl grid place-items-center shrink-0" style={{ background: `${meta.color}1f`, border: `1px solid ${meta.color}44` }}>
            <meta.icon className="h-7 w-7" style={{ color: meta.color }} />
          </div>
          <div>
            <div className="eyebrow">{meta.label}</div>
            <h1 className="font-display text-2xl font-extrabold" data-testid="policy-header-title">{p.policy_name}</h1>
            <div className="text-sm text-slate-500 mt-0.5">Uploaded {fmtDate(p.upload_date)}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/ask-ai/${id}`} data-testid="policy-ask-ai-button" className="px-4 py-2.5 rounded-xl border border-slate-700 hover:border-emerald-500/40 text-sm font-medium flex items-center gap-2 transition-all"><MessageSquareText className="h-4 w-4 text-emerald-400" /> Ask AI</Link>
          <button onClick={downloadReport} data-testid="policy-download-pdf-button" className="btn-glow px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-950 flex items-center gap-2"><Download className="h-4 w-4" /> Download Report</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column */}
        <div className="lg:col-span-8 space-y-6">
          {/* AI Summary + simple explanation */}
          <div className="card-v p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold">Simple Explanation</h3>
              <div className="flex gap-1 bg-slate-900/60 rounded-lg p-1 border border-slate-800">
                {LANGUAGES.map((l) => (
                  <button key={l.code} onClick={() => setLang(l.code)} data-testid={`policy-lang-switch-${l.code}`}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${lang === l.code ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400 hover:text-slate-200"}`}>
                    {l.native}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-slate-300 leading-relaxed" data-testid="policy-simple-explanation">{explanation}</p>
            <div className="mt-4"><VoicePlayer text={explanation} lang={lang} /></div>
            <div className="mt-5 pt-5 border-t border-slate-800">
              <div className="eyebrow mb-2">AI Summary</div>
              <p className="text-sm text-slate-400 leading-relaxed">{a.summary}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="card-v p-6">
            <div className="flex gap-2 overflow-x-auto pb-2 mb-5 border-b border-slate-800">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} data-testid={`policy-tab-${t.id === "waiting" ? "waiting-period" : t.id}`}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === t.id ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400 hover:text-slate-200"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === "overview" && (
              <div className="space-y-6">
                <ListBlock title="Key Benefits" items={a.benefits} icon={CheckCircle2} />
                <ListBlock title="Limitations" items={a.limitations} icon={AlertTriangle} />
                <ListBlock title="Important Terms" items={a.important_terms} icon={FileText} />
                <div>
                  <h4 className="font-display font-semibold mb-2">Premium Information</h4>
                  <p className="text-sm text-slate-400">{a.premium_info || "Not specified."}</p>
                </div>
              </div>
            )}
            {tab === "coverage" && <ListBlock title="What's Covered" items={a.coverage} icon={CheckCircle2} />}
            {tab === "exclusions" && <ListBlock title="What's NOT Covered" items={a.exclusions} icon={XCircle} />}
            {tab === "waiting" && (
              <div>
                <h4 className="font-display font-semibold mb-2">Waiting Period</h4>
                <p className="text-slate-300">{a.waiting_period || "None mentioned."}</p>
              </div>
            )}
            {tab === "claims" && <ListBlock title="Claim Conditions" items={a.claim_conditions} icon={ChevronRight} />}
          </div>

          {/* Recommendations */}
          <div className="card-v p-6">
            <h3 className="font-display text-lg font-bold mb-4">Recommendations</h3>
            <div className="space-y-2.5">
              {(a.recommendations || []).map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-300">{typeof rec === "object" ? rec.item || JSON.stringify(rec) : rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Risk */}
          <div className="card-v p-6" data-testid="policy-risk-breakdown-card">
            <h3 className="font-display text-lg font-bold mb-2">Overall Risk Score</h3>
            <RiskGauge score={r.overall_score || 0} level={r.risk_level || "Low"} />
            <span className={`mt-3 mx-auto block w-fit text-xs px-3 py-1 rounded-full border ${riskBadgeClass(r.risk_level)}`}>{r.risk_level} Risk</span>

            <div className="mt-6">
              <div className="eyebrow mb-3">Risk Breakdown</div>
              <ResponsiveContainer width="100%" height={Math.max(120, (r.breakdown?.length || 1) * 40)}>
                <BarChart layout="vertical" data={r.breakdown || []} margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" dataKey="factor" width={110} stroke="#94A3B8" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#0C1427", border: "1px solid #1E293B", borderRadius: 12 }} />
                  <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                    {(r.breakdown || []).map((b, i) => <Cell key={i} fill={riskColor(b.score)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {r.reasons?.length > 0 && (
              <div className="mt-4">
                <div className="eyebrow mb-2">Why this risk?</div>
                <ul className="space-y-1.5">
                  {r.reasons.slice(0, 4).map((why, i) => (
                    <li key={i} className="text-sm text-slate-400 flex items-start gap-2"><AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" /> {why}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Validity / renewal */}
          <PolicyValidity policy={p} onUpdated={setP} />

          {/* Blockchain verification */}
          <div className="ledger-card p-6" data-testid="policy-blockchain-verify-pill">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><span className="pulse-dot" /><span className="text-sm font-semibold text-emerald-300">Blockchain Verification</span></div>
              {verified ? (
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> VERIFIED</span>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">MODIFIED</span>
              )}
            </div>
            <div className="space-y-3">
              {[
                { label: "SHA-256 Document Hash", value: v.document_hash, icon: Hash, testid: "policy-blockchain-hash-display" },
                { label: "IPFS CID", value: v.ipfs_cid, icon: Boxes },
                { label: "Transaction Hash", value: v.tx_hash, icon: Link2 },
              ].map((f) => (
                <div key={f.label}>
                  <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><f.icon className="h-3.5 w-3.5" /> {f.label}</div>
                  <button onClick={() => copy(f.value, f.label)} data-testid={f.testid}
                    className="hash-chip rounded-lg px-3 py-2 text-xs text-slate-300 w-full flex items-center justify-between gap-2 hover:border-emerald-500/40 transition-colors">
                    <span className="truncate">{shortHash(f.value, 14)}</span><Copy className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Network</span><span className="text-slate-300">{v.network}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Block</span><span className="text-slate-300 font-mono">#{v.block_number}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Ledger</span><LedgerBadge mode={v.ledger_mode} />
              </div>
              <a href={`/policies/${id}/document`} onClick={(e) => { e.preventDefault(); const t = localStorage.getItem("veritrust_token"); fetch(`${API}/policies/${id}/document`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.blob()).then(b => window.open(URL.createObjectURL(b), "_blank")); }}
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:underline"><ExternalLink className="h-3.5 w-3.5" /> View original document</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
