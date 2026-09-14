import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarClock, Pencil, Save, Loader2, X, RefreshCw, ArrowLeftRight } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { fmtDate, expiryMeta, notifyAlertsChanged } from "@/lib/format";

export default function PolicyValidity({ policy, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(policy.policy_start_date || "");
  const [end, setEnd] = useState(policy.policy_end_date || "");
  const [saving, setSaving] = useState(false);
  const em = expiryMeta(policy.days_to_expiry);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/policies/${policy.id}/dates`, { policy_start_date: start || null, policy_end_date: end || null });
      onUpdated(data); setEditing(false); notifyAlertsChanged();
      toast.success(end ? "Renewal tracking updated" : "Dates saved");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Could not save dates.");
    } finally { setSaving(false); }
  };

  const input = "w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500/50 [color-scheme:dark]";

  return (
    <div className="card-v p-6" data-testid="policy-validity-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg font-bold flex items-center gap-2"><CalendarClock className="h-5 w-5 text-amber-400" /> Policy Validity</h3>
        {!editing && (
          <button onClick={() => setEditing(true)} data-testid="policy-edit-dates-button" className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:border-emerald-500/40 text-slate-300 inline-flex items-center gap-1"><Pencil className="h-3 w-3" /> {policy.policy_end_date ? "Edit" : "Set dates"}</button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Start date</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="policy-start-date-input" className={input} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">End / expiry date</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="policy-end-date-input" className={input} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving} data-testid="policy-save-dates-button" className="btn-glow flex-1 py-2 rounded-lg text-sm font-semibold text-slate-950 inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save</>}
            </button>
            <button onClick={() => { setEditing(false); setStart(policy.policy_start_date || ""); setEnd(policy.policy_end_date || ""); }} data-testid="policy-cancel-dates-button" className="px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-400"><X className="h-4 w-4" /></button>
          </div>
        </div>
      ) : policy.policy_end_date ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Start</span><span className="text-slate-300">{policy.policy_start_date ? fmtDate(policy.policy_start_date) : "—"}</span></div>
          <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Expires</span><span className="text-slate-300" data-testid="policy-end-date-display">{fmtDate(policy.policy_end_date)}</span></div>
          <div className={`rounded-xl px-4 py-3 border text-sm font-semibold text-center ${em.cls}`} data-testid="policy-expiry-badge">
            {policy.days_to_expiry < 0 ? `Expired ${Math.abs(policy.days_to_expiry)} day${Math.abs(policy.days_to_expiry) === 1 ? "" : "s"} ago`
              : policy.days_to_expiry === 0 ? "Expires today — renew now"
              : `${policy.days_to_expiry} day${policy.days_to_expiry === 1 ? "" : "s"} until renewal`}
          </div>
          <p className="text-xs text-slate-500">You'll be reminded 30, 15 and 7 days before expiry.</p>
          {!policy.renewal_of_policy_id && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link to={`/upload?renewal_of=${policy.id}`} data-testid="policy-upload-renewal-quote-link" className="px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-xs font-medium text-emerald-300 inline-flex items-center justify-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Upload renewal quote</Link>
              <Link to={`/renewals/${policy.id}`} data-testid="policy-compare-renewal-link" className="px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-300 inline-flex items-center justify-center gap-1.5"><ArrowLeftRight className="h-3.5 w-3.5" /> Compare renewal</Link>
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-slate-400" data-testid="policy-no-dates-state">
          The document didn't state an expiry date. Set one to receive renewal reminders.
        </div>
      )}
    </div>
  );
}
