import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ShieldCheck, Search, Loader2, Copy, Hash, Boxes, Link2, CheckCircle2, XCircle, FileSearch,
  UploadCloud, FileText, X, History, ShieldAlert,
} from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import LedgerBadge from "@/components/LedgerBadge";
import { shortHash, fmtDate, notifyAlertsChanged } from "@/lib/format";

function copy(t, l = "Copied") { navigator.clipboard.writeText(t); toast.success(`${l} to clipboard`); }

const SOURCE_LABEL = { MANUAL: "Hash / ID lookup", REUPLOAD: "Re-uploaded copy", AUTO_SWEEP: "Automatic integrity sweep" };

function ResultCard({ result }) {
  const ok = result.integrity_status === "VERIFIED";
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className={`ledger-card p-6 ${ok ? "" : "!border-rose-500/30"}`} data-testid="verify-result-card">
      <div className="flex items-center gap-3 mb-5">
        {ok ? <CheckCircle2 className="h-10 w-10 text-emerald-400" /> : <XCircle className="h-10 w-10 text-rose-400" />}
        <div className="flex-1">
          <div className={`font-display text-xl font-extrabold ${ok ? "text-emerald-400" : "text-rose-400"}`} data-testid="verify-certificate-badge">
            {ok ? "DOCUMENT VERIFIED" : "DOCUMENT MODIFIED / HASH MISMATCH"}
          </div>
          <div className="text-sm text-slate-400">{result.policy_name}{result.file_name ? ` · ${result.file_name}` : ""} · Anchored {result.verified_at ? fmtDate(result.verified_at) : "—"}</div>
        </div>
        {!ok && <Link to="/alerts" data-testid="verify-fraud-alert-link" className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 inline-flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Fraud alert raised</Link>}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {[
          { label: "On-chain SHA-256 Hash", value: result.document_hash, icon: Hash },
          { label: "Recomputed Hash", value: result.current_hash || "—", icon: Hash },
          { label: "IPFS CID", value: result.ipfs_cid, icon: Boxes, testid: "verify-ipfs-cid-link" },
          { label: "Transaction Hash", value: result.tx_hash, icon: Link2, testid: "verify-polygon-tx-link" },
        ].map((f) => (
          <div key={f.label}>
            <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><f.icon className="h-3.5 w-3.5" /> {f.label}</div>
            <button onClick={() => copy(f.value, f.label)} data-testid={f.testid}
              className="hash-chip rounded-lg px-3 py-2 text-xs text-slate-300 w-full flex items-center justify-between gap-2 hover:border-emerald-500/40 transition-colors">
              <span className="truncate">{shortHash(f.value, 16)}</span><Copy className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-5 border-t border-slate-800 grid sm:grid-cols-2 gap-3 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">Network</span><span className="text-slate-300">{result.network}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Block Number</span><span className="text-slate-300 font-mono">#{result.block_number}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Contract</span><span className="text-slate-300 font-mono">{shortHash(result.contract_address, 8)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Integrity</span><span className={ok ? "text-emerald-400" : "text-rose-400"}>{ok ? "Intact" : "Tampered"}</span></div>
        <div className="flex justify-between sm:col-span-2 items-center"><span className="text-slate-500">Ledger</span><LedgerBadge mode={result.ledger_mode} /></div>
      </div>
    </motion.div>
  );
}

function ReuploadPanel({ policies, onResult }) {
  const inputRef = useRef();
  const [policyId, setPolicyId] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!policyId) return toast.error("Select the policy this copy belongs to.");
    if (!file) return toast.error("Choose the document copy to check.");
    setBusy(true);
    const fd = new FormData();
    fd.append("policy_id", policyId); fd.append("file", file);
    try {
      const { data } = await api.post("/verify/reupload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onResult(data);
      if (data.matches) toast.success("Copy matches the on-chain record.");
      else toast.error("Hash mismatch — fraud alert raised.");
      notifyAlertsChanged();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Re-verification failed.");
    } finally { setBusy(false); }
  };

  return (
    <div className="card-v p-6" data-testid="verify-reupload-panel">
      <h3 className="font-display font-bold mb-1 flex items-center gap-2"><UploadCloud className="h-4 w-4 text-blue-400" /> Re-verify a copy you hold</h3>
      <p className="text-xs text-slate-500 mb-4">Upload any copy of a policy document. Its SHA-256 hash is compared against the version anchored on-chain — a mismatch raises a fraud alert instantly.</p>
      {policies.length === 0 ? (
        <p className="text-sm text-slate-400" data-testid="verify-reupload-empty">Upload and analyze a policy first, then you can re-verify copies here.</p>
      ) : (
        <div className="space-y-3">
          <select value={policyId} onChange={(e) => setPolicyId(e.target.value)} data-testid="verify-reupload-policy-select"
            className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500/50">
            <option value="">Select policy…</option>
            {policies.map((p) => <option key={p.id} value={p.id}>{p.policy_name}</option>)}
          </select>
          <div onClick={() => inputRef.current?.click()} data-testid="verify-reupload-dropzone"
            className="card-v cursor-pointer p-5 text-center border-dashed">
            <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" data-testid="verify-reupload-file-input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {file ? (
              <div className="flex items-center justify-center gap-3 text-sm"><FileText className="h-5 w-5 text-emerald-400" /><span className="truncate">{file.name}</span>
                <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="p-1 rounded hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
            ) : <div className="text-sm text-slate-400">Click to choose the document copy</div>}
          </div>
          <button onClick={run} disabled={busy} data-testid="verify-reupload-submit" className="btn-glow w-full py-2.5 rounded-xl text-sm font-semibold text-slate-950 inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="h-4 w-4" /> Check against on-chain record</>}
          </button>
        </div>
      )}
    </div>
  );
}

export default function VerificationCenter() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [history, setHistory] = useState([]);

  const loadHistory = useCallback(() => api.get("/verify/history").then((r) => setHistory(r.data)).catch(() => {}), []);
  useEffect(() => {
    api.get("/policies").then((r) => setPolicies(r.data)).catch(() => {});
    loadHistory();
  }, [loadHistory]);

  const verify = async () => {
    if (!query.trim()) return toast.error("Enter a document hash or policy ID.");
    setLoading(true); setResult(null);
    try {
      const { data } = await api.post("/verify", { query: query.trim() });
      setResult(data); loadHistory();
      if (!data.matches) notifyAlertsChanged();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Verification failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <div className="eyebrow mb-1">Blockchain Explorer</div>
        <h1 className="font-display text-3xl font-extrabold flex items-center gap-2"><ShieldCheck className="h-7 w-7 text-emerald-400" /> Verification Center</h1>
        <p className="text-slate-400 mt-1">Verify document integrity by recomputing the SHA-256 hash and matching it against the immutable on-chain record.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <div className="card-v p-6">
            <label className="text-sm text-slate-400 mb-2 block">Document Hash or Policy ID</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && verify()}
                  data-testid="verify-input-hash" placeholder="Paste SHA-256 hash or policy ID…"
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm font-mono outline-none focus:border-emerald-500/50" />
              </div>
              <button onClick={verify} disabled={loading} data-testid="verify-button-execute"
                className="btn-glow px-6 py-3 rounded-xl font-semibold text-slate-950 flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><FileSearch className="h-5 w-5" /> Verify</>}
              </button>
            </div>
          </div>

          {result && <ResultCard result={result} />}

          <div className="card-v p-6" data-testid="verify-history-card">
            <h3 className="font-display font-bold mb-1 flex items-center gap-2"><History className="h-4 w-4 text-emerald-400" /> Verification History</h3>
            <p className="text-xs text-slate-500 mb-4">Every integrity check you run, plus any mismatch caught by the automatic sweep.</p>
            {history.length === 0 ? (
              <div className="text-center py-8" data-testid="verify-history-empty">
                <FileSearch className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No verification history yet.</p>
                <p className="text-xs text-slate-500 mt-1">Run a hash lookup or re-verify a copy to create your first record.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((h) => {
                  const ok = h.result === "VERIFIED";
                  return (
                    <div key={h.id} data-testid="verify-history-row" className={`flex items-center gap-3 p-3 rounded-lg border ${ok ? "border-slate-800 bg-slate-900/40" : "border-rose-500/30 bg-rose-500/5"}`}>
                      {ok ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" /> : <XCircle className="h-5 w-5 text-rose-400 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate"><Link to={`/policy/${h.policy_id}`} className="hover:text-emerald-400">{h.policy_name}</Link></div>
                        <div className="text-xs text-slate-500">{SOURCE_LABEL[h.source] || h.source} · {new Date(h.created_at).toLocaleString()}</div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${ok ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border-rose-500/30"}`}>{ok ? "Verified" : "Mismatch"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <ReuploadPanel policies={policies} onResult={(r) => { setResult(r); loadHistory(); }} />
          <div className="card-v p-6">
            <h3 className="font-display font-bold mb-3">How verification works</h3>
            <div className="space-y-3 text-sm text-slate-400">
              <div className="flex items-start gap-2"><Hash className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" /> Every document gets a unique SHA-256 fingerprint at upload.</div>
              <div className="flex items-start gap-2"><Boxes className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" /> The original file is stored on IPFS and referenced by its CID.</div>
              <div className="flex items-start gap-2"><Link2 className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" /> The hash is anchored on-chain — any change breaks the match and triggers a fraud alert.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
