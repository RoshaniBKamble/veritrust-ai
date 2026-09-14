import { motion } from "framer-motion";
import { riskColor } from "@/lib/format";

export default function RiskGauge({ score = 0, level = "Low", size = 200 }) {
  const radius = size / 2 - 16;
  const circumference = Math.PI * radius; // half circle
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = riskColor(score);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="flex flex-col items-center" data-testid="policy-risk-gauge-score">
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <path
          d={`M 16 ${cy} A ${radius} ${radius} 0 0 1 ${size - 16} ${cy}`}
          fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="14" strokeLinecap="round"
        />
        <motion.path
          d={`M 16 ${cy} A ${radius} ${radius} 0 0 1 ${size - 16} ${cy}`}
          fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="-mt-14 flex flex-col items-center">
        <motion.span
          className="font-display text-5xl font-extrabold" style={{ color }}
          initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
        >
          {score}
        </motion.span>
        <span className="text-xs text-slate-400 mt-1">out of 100</span>
        <span className="mt-2 text-sm font-semibold" style={{ color }}>{level} Risk</span>
      </div>
    </div>
  );
}
