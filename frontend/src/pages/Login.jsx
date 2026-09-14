import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Hexagon, ShieldCheck, Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await login(email, password);
      toast.success("Welcome back to VeriTrust AI");
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
          <h2 className="font-display text-4xl font-extrabold leading-tight">Understand your insurance.<br /><span className="text-emerald-400">Trust your documents.</span></h2>
          <p className="mt-4 text-slate-400 max-w-md">Sign in to analyze policies, view risk scores and verify document integrity on-chain.</p>
        </div>
        <div className="relative text-sm text-slate-500">AI Intelligence · Simple Understanding · Blockchain Trust</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <Hexagon className="h-8 w-8 text-emerald-400" /><span className="font-display font-extrabold text-lg">VeriTrust AI</span>
          </div>
          <div className="card-v p-8">
            <div className="eyebrow mb-2">Welcome back</div>
            <h1 className="font-display text-2xl font-bold mb-6">Sign in to your account</h1>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Email</label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input data-testid="login-email-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-emerald-500/50 transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input data-testid="login-password-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-emerald-500/50 transition-colors" />
                </div>
              </div>
              {error && <div data-testid="login-error" className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</div>}
              <button data-testid="login-submit-button" disabled={loading}
                className="btn-glow w-full py-3 rounded-xl font-semibold text-slate-950 flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Sign In <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
            <p className="mt-6 text-sm text-slate-400 text-center">
              New to VeriTrust? <Link to="/register" data-testid="login-to-register" className="text-emerald-400 font-medium hover:underline">Create an account</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
