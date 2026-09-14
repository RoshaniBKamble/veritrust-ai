import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Send, Loader2, Sparkles, MessageSquareText, Bot, User as UserIcon, ClipboardCheck } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import ClaimCheck from "@/components/ClaimCheck";
import { LANGUAGES, categoryMeta } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

const QUICK = [
  "Does my policy cover surgery?",
  "What are my exclusions?",
  "What is my waiting period?",
  "What are the biggest risks in this policy?",
  "What happens when I make a claim?",
  "Is this policy good for me?",
];

export default function AskAI() {
  const { id } = useParams();
  const { user } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [policyId, setPolicyId] = useState(id || "");
  const [lang, setLang] = useState(user?.preferred_language || "en");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("chat");
  const scrollRef = useRef();

  useEffect(() => { api.get("/policies").then((r) => { setPolicies(r.data); if (!policyId && r.data[0]) setPolicyId(r.data[0].id); }); }, []); // eslint-disable-line

  useEffect(() => {
    if (!policyId) return;
    api.get(`/ai/history/${policyId}`).then((r) => setMessages(r.data)).catch(() => setMessages([]));
  }, [policyId]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  const ask = async (question) => {
    const q = (question || input).trim();
    if (!q) return;
    if (!policyId) return toast.error("Select a policy first.");
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLoading(true);
    try {
      const { data } = await api.post(`/ai/ask/${policyId}`, { question: q, language: lang });
      setMessages((m) => [...m, { role: "assistant", content: data.answer }]);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Failed to get an answer.");
      setMessages((m) => m.slice(0, -1));
    } finally { setLoading(false); }
  };

  const activePolicy = policies.find((p) => p.id === policyId);

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow mb-1">Policy Assistant</div>
        <h1 className="font-display text-3xl font-extrabold flex items-center gap-2"><Sparkles className="h-7 w-7 text-emerald-400" /> Ask VeriTrust AI</h1>
        <p className="text-slate-400 mt-1">Ask anything about your uploaded policy. Answers are grounded in your document.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <div className="card-v p-5">
            <label className="text-sm text-slate-400 mb-2 block">Policy</label>
            <select value={policyId} onChange={(e) => setPolicyId(e.target.value)} data-testid="ask-ai-policy-select"
              className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500/50">
              <option value="">Select a policy…</option>
              {policies.map((p) => <option key={p.id} value={p.id}>{p.policy_name}</option>)}
            </select>
            {activePolicy && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                {(() => { const M = categoryMeta(activePolicy.category); return <M.icon className="h-4 w-4" style={{ color: M.color }} />; })()}
                {categoryMeta(activePolicy.category).label}
              </div>
            )}
            <label className="text-sm text-slate-400 mb-2 mt-4 block">Answer Language</label>
            <div className="flex gap-1 bg-slate-900/60 rounded-lg p-1 border border-slate-800">
              {LANGUAGES.map((l) => (
                <button key={l.code} onClick={() => setLang(l.code)} data-testid={`ask-ai-lang-${l.code}`}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${lang === l.code ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`}>{l.native}</button>
              ))}
            </div>
          </div>
          <div className="card-v p-5">
            <div className="text-sm font-medium text-slate-300 mb-3">Suggested questions</div>
            <div className="space-y-2">
              {QUICK.map((q, i) => (
                <button key={q} onClick={() => ask(q)} data-testid={`ask-ai-quick-prompt-${i + 1}`}
                  className="w-full text-left text-sm text-slate-400 hover:text-emerald-300 p-2.5 rounded-lg hover:bg-slate-800/50 transition-colors border border-slate-800">{q}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="flex gap-2 bg-slate-900/40 rounded-xl p-1 border border-slate-800 w-fit">
            <button onClick={() => setMode("chat")} data-testid="ask-ai-mode-chat" className={`px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 ${mode === "chat" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400 hover:text-slate-200"}`}><MessageSquareText className="h-4 w-4" /> Chat</button>
            <button onClick={() => setMode("claim")} data-testid="ask-ai-mode-claim" className={`px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 ${mode === "claim" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400 hover:text-slate-200"}`}><ClipboardCheck className="h-4 w-4" /> Can I claim?</button>
          </div>
          {mode === "claim" ? (
            <div className="card-v p-6" data-testid="ask-ai-claim-panel">
              {policyId ? <ClaimCheck policyId={policyId} defaultLang={lang} /> : <p className="text-sm text-slate-400">Select a policy to run a claim check.</p>}
            </div>
          ) : (
          <div className="card-v flex flex-col h-[70vh]">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4" data-testid="ask-ai-chat-thread">
              {messages.length === 0 && !loading && (
                <div className="h-full grid place-items-center text-center">
                  <div>
                    <MessageSquareText className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">Ask a question or pick a suggestion to get started.</p>
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`} data-testid="ask-ai-response-bubble">
                  <div className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${m.role === "user" ? "bg-blue-500/15" : "bg-emerald-500/15"}`}>
                    {m.role === "user" ? <UserIcon className="h-4 w-4 text-blue-400" /> : <Bot className="h-4 w-4 text-emerald-400" />}
                  </div>
                  <div className={`max-w-[80%] p-3.5 rounded-2xl text-sm leading-relaxed ${m.role === "user" ? "bg-blue-500/10 border border-blue-500/20" : "bg-slate-900/60 border border-slate-800"}`}>
                    {m.content}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-lg grid place-items-center bg-emerald-500/15"><Bot className="h-4 w-4 text-emerald-400" /></div>
                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800"><Loader2 className="h-4 w-4 animate-spin text-emerald-400" /></div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-800">
              <div className="flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()}
                  data-testid="ask-ai-input-field" placeholder="Ask about your policy…"
                  className="flex-1 bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500/50" />
                <button onClick={() => ask()} disabled={loading} data-testid="ask-ai-send-button"
                  className="btn-glow px-5 rounded-xl text-slate-950 flex items-center justify-center disabled:opacity-60"><Send className="h-5 w-5" /></button>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
