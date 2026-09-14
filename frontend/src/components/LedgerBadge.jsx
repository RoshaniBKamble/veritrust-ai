import { FlaskConical, Radio } from "lucide-react";

export default function LedgerBadge({ mode, className = "" }) {
  const live = mode === "live";
  return (
    <span data-testid="ledger-mode-badge" title={live ? "Recorded by a real transaction on Polygon Amoy" : "Real SHA-256 + CID, recorded on a local simulated ledger — not a live Polygon transaction"}
      className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${
        live ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" : "bg-amber-500/10 text-amber-300 border-amber-500/30"} ${className}`}>
      {live ? <Radio className="h-3 w-3" /> : <FlaskConical className="h-3 w-3" />}
      {live ? "Live on-chain" : "Simulated ledger · dev mode"}
    </span>
  );
}
