import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  UploadCloud, FileText, X, CheckCircle2, Loader2, ScanText, Brain, Activity,
  Sparkles, Hash, Boxes, ShieldCheck, RefreshCw,
} from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { CATEGORIES } from "@/lib/format";

const STEPS = [
  { label: "Uploading document", icon: UploadCloud },
  { label: "Extracting policy text (OCR)", icon: ScanText },
  { label: "Analyzing policy with AI", icon: Brain },
  { label: "Calculating risk score", icon: Activity },
  { label: "Generating simple explanation", icon: Sparkles },
  { label: "Creating SHA-256 document hash", icon: Hash },
  { label: "Uploading to IPFS", icon: Boxes },
  { label: "Verifying on blockchain", icon: ShieldCheck },
];

export default function Upload() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const renewalOf = params.get("renewal_of") || "";
  const inputRef = useRef();
  const [original, setOriginal] = useState(null);
  const [category, setCategory] = useState("");
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [drag, setDrag] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!renewalOf) return;
    api.get(`/policies/${renewalOf}`).then((r) => { setOriginal(r.data); setCategory(r.data.category); })
      .catch(() => toast.error("The policy to renew was not found."));
  }, [renewalOf]);

  useEffect(() => {
    if (!processing) return;
    // advance visual steps up to the second-to-last while the request is in flight
    const t = setInterval(() => setStep((s) => (s < STEPS.length - 1 ? s + 1 : s)), 3500);
    return () => clearInterval(t);
  }, [processing]);

  const pick = (f) => {
    if (!f) return;
    const ok = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!ok.includes(f.type) && !/\.(pdf|jpe?g|png)$/i.test(f.name)) {
      toast.error("Unsupported file. Use PDF, JPG, JPEG or PNG."); return;
    }
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const submit = async () => {
    if (!category) return toast.error("Please select an insurance category.");
    if (!file) return toast.error("Please choose a policy document.");
    setProcessing(true); setStep(0);
    const fd = new FormData();
    fd.append("category", category);
    fd.append("policy_name", name || file.name);
    if (renewalOf) fd.append("renewal_of", renewalOf);
    fd.append("file", file);
    try {
      const { data } = await api.post("/policies/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setStep(STEPS.length);
      toast.success(renewalOf ? "Renewal quote analyzed & linked!" : "Analysis complete!");
      setTimeout(() => navigate(renewalOf ? `/renewals/${renewalOf}?quote=${data.id}` : `/policy/${data.id}`), 900);
    } catch (err) {
      setProcessing(false);
      toast.error(formatApiError(err.response?.data?.detail) || "Upload failed. Please try again.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <div className="eyebrow mb-1">{renewalOf ? "Renewal Quote" : "Upload & Analyze"}</div>
        <h1 className="font-display text-3xl font-extrabold">{renewalOf ? "Upload a renewal quote" : "Upload a policy"}</h1>
        <p className="text-slate-400 mt-1">{renewalOf ? "The quote gets the full treatment — OCR, AI analysis, SHA-256 hash and verification — then it's linked to your expiring policy for a side-by-side." : "Select a category and upload your insurance document. VeriTrust AI does the rest."}</p>
      </div>

      {renewalOf && original && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3" data-testid="upload-renewal-banner">
          <RefreshCw className="h-5 w-5 text-emerald-400 shrink-0" />
          <div className="text-sm flex-1 min-w-0">Renewal quote for <span className="font-semibold">{original.policy_name}</span>{original.days_to_expiry != null && <span className="text-slate-400"> · {original.days_to_expiry < 0 ? "expired" : `${original.days_to_expiry} days left`}</span>}</div>
          <Link to="/upload" className="text-xs text-slate-400 hover:text-slate-200">Upload as a normal policy instead</Link>
        </div>
      )}

      {!processing ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div>
            <label className="text-sm font-medium text-slate-300 mb-3 block">1. Insurance Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" data-testid="upload-category-select">
              {CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => setCategory(c.id)} data-testid={`upload-category-${c.id}`}
                  className={`card-v p-4 flex flex-col items-center gap-2 text-center transition-all ${category === c.id ? "!border-emerald-500/60 bg-emerald-500/5" : ""}`}>
                  <c.icon className="h-6 w-6" style={{ color: category === c.id ? c.color : "#64748B" }} />
                  <span className="text-xs font-medium">{c.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300 mb-3 block">2. Policy Document</label>
            <div
              data-testid="upload-file-dropzone"
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
              onClick={() => inputRef.current?.click()}
              className={`card-v cursor-pointer p-10 text-center border-dashed transition-all ${drag ? "!border-emerald-500/60 bg-emerald-500/5" : ""}`}>
              <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                data-testid="upload-file-input" onChange={(e) => pick(e.target.files?.[0])} />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-emerald-400" />
                  <div className="text-left">
                    <div className="font-semibold">{file.name}</div>
                    <div className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="p-1.5 rounded-lg hover:bg-slate-800"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <>
                  <UploadCloud className="h-10 w-10 text-slate-500 mx-auto mb-3" />
                  <div className="font-medium">Drop your file here, or click to browse</div>
                  <div className="text-xs text-slate-500 mt-1">PDF, JPG, JPEG or PNG · up to 15MB</div>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">3. Policy Name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} data-testid="upload-name-input"
              placeholder="e.g. SecureHealth Gold Plan"
              className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500/50" />
          </div>

          <button onClick={submit} data-testid="upload-submit-button"
            className="btn-glow w-full py-4 rounded-xl font-semibold text-slate-950 flex items-center justify-center gap-2">
            <Brain className="h-5 w-5" /> Analyze with VeriTrust AI
          </button>
        </motion.div>
      ) : (
        <div className="card-v p-8" data-testid="upload-progress-stepper">
          <h3 className="font-display text-xl font-bold mb-1">Processing your policy…</h3>
          <p className="text-slate-400 text-sm mb-6">This usually takes under a minute. Please keep this tab open.</p>
          <div className="space-y-3">
            {STEPS.map((s, i) => {
              const done = i < step || step >= STEPS.length;
              const active = i === step && step < STEPS.length;
              return (
                <div key={s.label} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  done ? "border-emerald-500/30 bg-emerald-500/5" : active ? "border-blue-500/30 bg-blue-500/5" : "border-slate-800 opacity-50"}`}>
                  <div className="h-8 w-8 rounded-lg grid place-items-center shrink-0">
                    {done ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      : active ? <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                      : <s.icon className="h-5 w-5 text-slate-600" />}
                  </div>
                  <span className={`text-sm ${done ? "text-emerald-300" : active ? "text-blue-300" : "text-slate-500"}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
          <AnimatePresence>
            {step >= STEPS.length && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-center text-emerald-400 font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5" /> Analysis Complete — opening results…
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
