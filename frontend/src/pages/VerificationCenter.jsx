import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ShieldCheck, Search, Loader2, Copy, Hash, Boxes, Link2, CheckCircle2, XCircle, FileSearch,
} from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { shortHash, fmtDate } from "@/lib/format";

function copy(t, l = "Copied") { navigator.clipboard.writeText(t); toast.success(`${l} to clipboard`); }

export default function VerificationCenter() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const verify = async () => {
    if (!query.trim()) return toast.error("Enter a document hash or policy ID.");
    setLoading(true); setResult(null);
    try {
      const { data } = await api.post("/verify", { query: query.trim() });
      setResult(data);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Verification failed.");
    } finally { setLoading(false); }
  };

  const ok = result?.integrity_status === "VERIFIED";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <div className="eyebrow mb-1">Blockchain Explorer</div>
        <h1 className="font-display text-3xl font-extrabold flex items-center gap-2"><ShieldCheck className="h-7 w-7 text-emerald-400" /> Verification Center</h1>
        <p className="text-slate-400 mt-1">Verify document integrity by recomputing the SHA-256 hash and matching it against the immutable on-chain record.</p>
      </div>

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

      {result && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className={`ledger-card p-6 ${ok ? "" : "!border-rose-500/30"}`} data-testid="verify-result-card">
          <div className="flex items-center gap-3 mb-5">
            {ok ? <CheckCircle2 className="h-10 w-10 text-emerald-400" /> : <XCircle className="h-10 w-10 text-rose-400" />}
            <div>
              <div className={`font-display text-xl font-extrabold ${ok ? "text-emerald-400" : "text-rose-400"}`} data-testid="verify-certificate-badge">
                {ok ? "DOCUMENT VERIFIED" : "DOCUMENT MODIFIED / HASH MISMATCH"}
              </div>
              <div className="text-sm text-slate-400">{result.policy_name} · Verified {result.verified_at ? fmtDate(result.verified_at) : "—"}</div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: "Stored SHA-256 Hash", value: result.document_hash, icon: Hash },
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
          </div>
        </motion.div>
      )}

      <div className="card-v p-6">
        <h3 className="font-display font-bold mb-3">How verification works</h3>
        <div className="grid sm:grid-cols-3 gap-4 text-sm text-slate-400">
          <div className="flex items-start gap-2"><Hash className="h-4 w-4 text-emerald-400 mt-0.5" /> Every document gets a unique SHA-256 fingerprint at upload.</div>
          <div className="flex items-start gap-2"><Boxes className="h-4 w-4 text-blue-400 mt-0.5" /> The original file is stored on IPFS and referenced by its CID.</div>
          <div className="flex items-start gap-2"><Link2 className="h-4 w-4 text-amber-400 mt-0.5" /> The hash is anchored on-chain — any change breaks the match.</div>
        </div>
      </div>
    </div>
  );
}
