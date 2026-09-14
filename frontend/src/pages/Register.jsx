import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Hexagon, User, Mail, Lock, Loader2, ArrowRight, Languages } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { LANGUAGES } from "@/lib/format";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", preferred_language: "en" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await register(form);
      toast.success("Account created. Welcome to VeriTrust AI!");
      navigate("/dashboard");
    } catch (err) {
      const msg = formatApiError(err.response?.data?.detail) || err.message;
      setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen app-bg grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden border-r border-slate-800/60">
        <div className="absolute inset-0 grid-lines opacity-30" />
        <Link to="/" className="flex items-center gap-2.5 relative">
          <Hexagon className="h-9 w-9 text-emerald-400" strokeWidth={1.5} />
          <span className="font-display font-extrabold text-lg">VeriTrust<span className="text-emerald-400"> AI</span></span>
        </Link>
        <div className="relative">
          <h2 className="font-display text-4xl font-extrabold leading-tight">Join VeriTrust AI</h2>
          <p className="mt-4 text-slate-400 max-w-md">Create your account once — all your policies, analysis and verification history stay with you forever.</p>
          <ul className="mt-6 space-y-2 text-sm text-slate-400">
            <li>• Unlimited policy analysis across 5 insurance types</li>
            <li>• Simple explanations in English, Hindi & Marathi</li>
            <li>• Blockchain-verified, tamper-evident documents</li>
          </ul>
        </div>
        <div className="relative text-sm text-slate-500">Your data is private and encrypted.</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="card-v p-8">
            <div className="eyebrow mb-2">Get started free</div>
            <h1 className="font-display text-2xl font-bold mb-6">Create your account</h1>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Full Name</label>
                <div className="relative">
                  <User className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input data-testid="register-name-input" required value={form.full_name} onChange={set("full_name")}
                    placeholder="Jane Doe"
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-emerald-500/50 transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Email</label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input data-testid="register-email-input" type="email" required value={form.email} onChange={set("email")}
                    placeholder="you@example.com"
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-emerald-500/50 transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input data-testid="register-password-input" type="password" required minLength={6} value={form.password} onChange={set("password")}
                    placeholder="At least 6 characters"
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-emerald-500/50 transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Preferred Language</label>
                <div className="relative">
                  <Languages className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
                  <select data-testid="register-language-select" value={form.preferred_language} onChange={set("preferred_language")}
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-emerald-500/50 appearance-none">
                    {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label} ({l.native})</option>)}
                  </select>
                </div>
              </div>
              {error && <div data-testid="register-error" className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</div>}
              <button data-testid="register-submit-button" disabled={loading}
                className="btn-glow w-full py-3 rounded-xl font-semibold text-slate-950 flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Create Account <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
            <p className="mt-6 text-sm text-slate-400 text-center">
              Already have an account? <Link to="/login" data-testid="register-to-login" className="text-emerald-400 font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
