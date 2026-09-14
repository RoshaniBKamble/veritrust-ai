import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { User as UserIcon, Mail, Languages, Save, Loader2, ShieldCheck, Calendar } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { LANGUAGES, fmtDate } from "@/lib/format";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [lang, setLang] = useState(user?.preferred_language || "en");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/auth/me", { full_name: fullName, preferred_language: lang });
      updateUser(data);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Update failed.");
    } finally { setSaving(false); }
  };

  const initials = (user?.full_name || "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <div className="eyebrow mb-1">Account</div>
        <h1 className="font-display text-3xl font-extrabold">Profile & Settings</h1>
        <p className="text-slate-400 mt-1">Manage your account details and preferences.</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-v p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-800">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 grid place-items-center text-xl font-bold text-slate-950">{initials}</div>
          <div>
            <div className="font-display text-xl font-bold">{user?.full_name}</div>
            <div className="text-sm text-slate-500 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {user?.email}</div>
            <div className="text-xs text-slate-600 flex items-center gap-1.5 mt-1"><Calendar className="h-3 w-3" /> Joined {fmtDate(user?.created_at)}</div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1.5 block">Full Name</label>
            <div className="relative">
              <UserIcon className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} data-testid="profile-name-input"
                className="w-full bg-slate-900/60 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-emerald-500/50" />
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1.5 block">Email (read-only)</label>
            <div className="relative">
              <Mail className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={user?.email} disabled className="w-full bg-slate-900/40 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-500" />
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1.5 block">Preferred Language</label>
            <div className="relative">
              <Languages className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
              <select value={lang} onChange={(e) => setLang(e.target.value)} data-testid="profile-language-select"
                className="w-full bg-slate-900/60 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-emerald-500/50 appearance-none">
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label} ({l.native})</option>)}
              </select>
            </div>
          </div>
          <button onClick={save} disabled={saving} data-testid="profile-save-button"
            className="btn-glow px-5 py-3 rounded-xl font-semibold text-slate-950 flex items-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-4 w-4" /> Save Changes</>}
          </button>
        </div>
      </motion.div>

      <div className="ledger-card p-6 flex items-center gap-4">
        <ShieldCheck className="h-8 w-8 text-emerald-400 shrink-0" />
        <div>
          <div className="font-semibold">Your data is private & secure</div>
          <div className="text-sm text-slate-400">Passwords are hashed with bcrypt and you can only ever access your own policies.</div>
        </div>
      </div>
    </div>
  );
}
