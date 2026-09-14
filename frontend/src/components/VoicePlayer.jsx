import { useState, useEffect, useRef } from "react";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import { SPEECH_LANG } from "@/lib/format";

export default function VoicePlayer({ text, lang = "en" }) {
  const [state, setState] = useState("idle"); // idle | playing | paused
  const utterRef = useRef(null);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  useEffect(() => { stop(); /* eslint-disable-next-line */ }, [text, lang]);

  const play = () => {
    if (!("speechSynthesis" in window) || !text) return;
    if (state === "paused") { window.speechSynthesis.resume(); setState("playing"); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = SPEECH_LANG[lang] || "en-US";
    u.rate = 0.98;
    u.onend = () => setState("idle");
    utterRef.current = u;
    window.speechSynthesis.speak(u);
    setState("playing");
  };
  const pause = () => { window.speechSynthesis.pause(); setState("paused"); };
  const stop = () => { window.speechSynthesis?.cancel(); setState("idle"); };

  return (
    <div className="glass rounded-xl p-4 flex items-center gap-4" data-testid="policy-voice-player">
      <div className="flex items-center gap-2">
        {state !== "playing" ? (
          <button onClick={play} data-testid="policy-voice-play-button"
            className="btn-glow h-11 w-11 rounded-full grid place-items-center text-slate-950">
            <Play className="h-5 w-5" fill="currentColor" />
          </button>
        ) : (
          <button onClick={pause} data-testid="policy-voice-pause-button"
            className="h-11 w-11 rounded-full grid place-items-center bg-amber-500 text-slate-950">
            <Pause className="h-5 w-5" fill="currentColor" />
          </button>
        )}
        <button onClick={stop} data-testid="policy-voice-stop-button"
          className="h-11 w-11 rounded-full grid place-items-center bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors">
          <Square className="h-4 w-4" fill="currentColor" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 h-6" data-testid="policy-voice-audio-status">
        {state === "playing" ? (
          [...Array(9)].map((_, i) => (
            <span key={i} className="wave-bar" style={{ animationDelay: `${i * 0.09}s` }} />
          ))
        ) : (
          <span className="text-sm text-slate-400 flex items-center gap-2">
            <Volume2 className="h-4 w-4" /> Listen to your policy explanation
          </span>
        )}
      </div>
    </div>
  );
}
