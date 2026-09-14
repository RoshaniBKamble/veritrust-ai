import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Hexagon, ShieldCheck, Brain, Languages, FileSearch, LockKeyhole, Cpu,
  ArrowRight, Fingerprint, BarChart3, Sparkles, HeartPulse, Car, Home, Plane, Shield, CheckCircle2,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.6, ease: "easeOut" } }),
};

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 glass border-b border-slate-800/60">
      <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5" data-testid="nav-brand-logo">
          <div className="relative grid place-items-center">
            <Hexagon className="h-9 w-9 text-emerald-400" strokeWidth={1.5} />
            <ShieldCheck className="h-4 w-4 text-emerald-300 absolute" />
          </div>
          <span className="font-display font-extrabold text-lg">VeriTrust<span className="text-emerald-400"> AI</span></span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" data-testid="landing-nav-login"
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">Login</Link>
          <Link to="/register" data-testid="landing-hero-cta-start"
            className="btn-glow px-4 py-2 rounded-full text-sm font-semibold text-slate-950 flex items-center gap-1.5">
            Get Started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

const PILLARS = [
  { icon: Brain, testid: "landing-pillar-ai", title: "AI Intelligence", desc: "Claude-powered analysis reads every clause, benefit and exclusion of your policy in seconds.", box: "bg-emerald-500/12 border-emerald-500/25", ic: "text-emerald-400" },
  { icon: Sparkles, testid: "landing-pillar-simplify", title: "Simple Understanding", desc: "Complex legal insurance language turned into short, friendly explanations anyone can grasp.", box: "bg-blue-500/12 border-blue-500/25", ic: "text-blue-400" },
  { icon: Fingerprint, testid: "landing-pillar-blockchain", title: "Blockchain Trust", desc: "SHA-256 hashing, IPFS storage and on-chain proof make your documents tamper-evident.", box: "bg-amber-500/12 border-amber-500/25", ic: "text-amber-400" },
];

const STEPS = [
  { n: "01", t: "Upload Policy", d: "Drop a PDF or image of any insurance policy." },
  { n: "02", t: "AI Analyzes", d: "OCR + AI extract, simplify and score your policy." },
  { n: "03", t: "Understand Risk", d: "Get an explainable 0–100 risk score & recommendations." },
  { n: "04", t: "Verify on Chain", d: "Document hash is recorded immutably for trust." },
];

const CATS = [
  { icon: HeartPulse, l: "Health" }, { icon: Car, l: "Vehicle" }, { icon: Home, l: "Home" },
  { icon: Plane, l: "Travel" }, { icon: Shield, l: "Life" },
];

export default function Landing() {
  return (
    <div className="min-h-screen app-bg text-slate-100 overflow-hidden">
      <Nav />

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-5">
        <div className="absolute inset-0 grid-lines opacity-40 pointer-events-none" />
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 items-center relative">
          <div className="lg:col-span-7">
            <motion.div variants={fadeUp} initial="hidden" animate="show" className="eyebrow mb-4 flex items-center gap-2">
              <span className="pulse-dot" /> AI + INSURANCE + BLOCKCHAIN
            </motion.div>
            <motion.h1 variants={fadeUp} custom={1} initial="hidden" animate="show"
              data-testid="landing-hero-headline"
              className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight">
              Understand Your Insurance.<br />
              <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-blue-400 bg-clip-text text-transparent">Trust Your Documents.</span>
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} initial="hidden" animate="show"
              className="mt-6 text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed">
              AI-powered insurance intelligence that simplifies complex policies into clear insights — with blockchain-based document verification you can trust.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} initial="hidden" animate="show" className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" data-testid="landing-hero-cta-demo"
                className="btn-glow px-6 py-3.5 rounded-full font-semibold text-slate-950 flex items-center gap-2">
                Analyze a Policy <ArrowRight className="h-5 w-5" />
              </Link>
              <Link to="/login"
                className="px-6 py-3.5 rounded-full font-semibold border border-slate-700 hover:border-emerald-500/40 hover:bg-slate-800/40 transition-all">
                I already have an account
              </Link>
            </motion.div>
            <motion.div variants={fadeUp} custom={4} initial="hidden" animate="show"
              data-testid="landing-stats-grid" className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              {[["5", "Insurance types"], ["3", "Languages"], ["100%", "Tamper-evident"]].map(([a, b]) => (
                <div key={b}>
                  <div className="font-display text-2xl font-extrabold text-emerald-400">{a}</div>
                  <div className="text-xs text-slate-500 mt-1">{b}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Hero visual */}
          <motion.div className="lg:col-span-5" data-testid="landing-interactive-preview"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.3 }}>
            <div className="ledger-card p-6 relative">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2 text-sm text-slate-300"><FileSearch className="h-4 w-4 text-emerald-400" /> SecureHealth Gold</div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified
                </span>
              </div>
              <div className="flex items-center gap-4 mb-5">
                <div className="relative h-24 w-24 shrink-0">
                  <svg viewBox="0 0 100 60" className="w-full">
                    <path d="M 8 52 A 42 42 0 0 1 92 52" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 8 52 A 42 42 0 0 1 92 52" fill="none" stroke="#F59E0B" strokeWidth="8" strokeLinecap="round" strokeDasharray="132" strokeDashoffset="66" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
                    <span className="font-display text-2xl font-extrabold text-amber-400">49</span>
                  </div>
                </div>
                <div className="text-sm text-slate-400 space-y-1.5">
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Room rent capped at 1%</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> 36-month PED wait</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> 10% co-pay above 60</div>
                </div>
              </div>
              <div className="hash-chip rounded-lg px-3 py-2 text-xs text-slate-400 truncate">
                sha256: 2c5b7fde2e2f8dba6b1da0a8debf6bb5…
              </div>
              <div className="mt-3 hash-chip rounded-lg px-3 py-2 text-xs text-slate-400 truncate">
                ipfs: QmRKoa4aho9Au1oh5hbtJ1oAFNSWkTumx…
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pillars */}
      <section className="px-5 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {PILLARS.map((p, i) => (
              <motion.div key={p.title} data-testid={p.testid} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="card-v p-7">
                <div className={`h-12 w-12 rounded-xl grid place-items-center mb-5 border ${p.box}`}>
                  <p.icon className={`h-6 w-6 ${p.ic}`} />
                </div>
                <h3 className="font-display text-xl font-bold mb-2">{p.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="px-5 py-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="eyebrow mb-3">Every policy, one platform</div>
          <div className="flex flex-wrap justify-center gap-4">
            {CATS.map((c) => (
              <div key={c.l} className="card-v px-6 py-4 flex items-center gap-3">
                <c.icon className="h-5 w-5 text-emerald-400" /><span className="font-medium">{c.l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-5 py-16">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-display text-3xl lg:text-4xl font-bold mb-10">How VeriTrust works</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <motion.div key={s.n} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="card-v p-6">
                <div className="font-mono text-emerald-400 text-sm mb-3">{s.n}</div>
                <h4 className="font-display font-bold text-lg mb-2">{s.t}</h4>
                <p className="text-sm text-slate-400">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security / Tech */}
      <section className="px-5 py-16">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 card-v p-8">
            <LockKeyhole className="h-8 w-8 text-emerald-400 mb-4" />
            <h3 className="font-display text-2xl font-bold mb-3">Security by design</h3>
            <p className="text-slate-400 mb-5">Passwords are hashed with bcrypt, routes are protected, and every user only ever sees their own policies. Your original document is content-addressed on IPFS and its SHA-256 fingerprint is anchored on-chain.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {["bcrypt password hashing", "JWT protected routes", "SHA-256 document fingerprint", "IPFS content addressing"].map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> {f}</div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 card-v p-8">
            <Cpu className="h-8 w-8 text-blue-400 mb-4" />
            <h3 className="font-display text-2xl font-bold mb-3">Built on a modern stack</h3>
            <div className="flex flex-wrap gap-2">
              {["React", "FastAPI", "PostgreSQL", "Claude AI", "Tesseract OCR", "IPFS", "Solidity", "Polygon"].map((t) => (
                <span key={t} className="hash-chip rounded-full px-3 py-1.5 text-xs text-slate-300">{t}</span>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-3 text-sm text-slate-400"><Languages className="h-5 w-5 text-emerald-400" /> English · हिंदी · मराठी</div>
            <div className="mt-2 flex items-center gap-3 text-sm text-slate-400"><BarChart3 className="h-5 w-5 text-blue-400" /> Visual risk analytics & reports</div>
          </div>
        </div>
      </section>

      <footer className="px-5 py-10 border-t border-slate-800/60">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2"><Hexagon className="h-5 w-5 text-emerald-400" /> VeriTrust AI © 2026</div>
          <div className="flex gap-6">
            <Link to="/register" className="hover:text-emerald-400">Get Started</Link>
            <Link to="/login" className="hover:text-emerald-400">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
