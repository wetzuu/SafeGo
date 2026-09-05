import { riskGradient } from "@/lib/safego/risk-model";

export function RiskGauge({ score, size = 150 }: { score: number; size?: number }) {
  const radius = size / 2 - 10;
  const center = size / 2;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const height = size / 1.7;

  return (
    <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`} aria-label={`${score}% risk index`}>
      <path d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`} fill="none" stroke="#d9d9d9" strokeWidth="10"/>
      <path d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`} fill="none" stroke={riskGradient(score)} strokeWidth="10" strokeDasharray={circumference} strokeDashoffset={offset}/>
      <text x={center} y={center - 6} textAnchor="middle" fontWeight="700" fontSize="20" fill="#1a1a1a">{score}%</text>
      <text x={center} y={center + 14} textAnchor="middle" fontSize="10.5" fill="#5c5c5c">risk index</text>
    </svg>
  );
}
