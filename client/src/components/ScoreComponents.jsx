export function ScoreRing({ score = 0, size = 148 }) {
  const strokeWidth = 10;
  const r = (size / 2) - strokeWidth;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  const gradientId = `score-grad-${score >= 90 ? 'emerald' : score >= 75 ? 'green' : score >= 50 ? 'amber' : 'rose'}`;
  
  const colors = score >= 90
    ? { start: '#10b981', end: '#06b6d4', text: '#34d399', glow: 'rgba(16, 185, 129, 0.35)' }
    : score >= 75
    ? { start: '#10b981', end: '#34d399', text: '#34d399', glow: 'rgba(52, 211, 153, 0.3)' }
    : score >= 50
    ? { start: '#f59e0b', end: '#fbbf24', text: '#fbbf24', glow: 'rgba(245, 158, 11, 0.3)' }
    : { start: '#f43f5e', end: '#fb7185', text: '#f87171', glow: 'rgba(244, 63, 94, 0.3)' };

  return (
    <div className="score-ring-wrap" style={{ width: size, height: size, filter: `drop-shadow(0 0 12px ${colors.glow})` }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.start} />
            <stop offset="100%" stopColor={colors.end} />
          </linearGradient>
        </defs>
        <circle
          className="score-ring-bg"
          cx={size / 2} cy={size / 2} r={r}
          strokeWidth={strokeWidth}
        />
        <circle
          className="score-ring-fill"
          cx={size / 2} cy={size / 2} r={r}
          strokeWidth={strokeWidth}
          stroke={`url(#${gradientId})`}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ strokeLinecap: 'round' }}
        />
      </svg>
      <div className="score-ring-label">
        <span className="score-ring-value" style={{ color: colors.text }}>{score}</span>
        <span className="score-ring-sub">READINESS SCORE</span>
      </div>
    </div>
  );
}

export function ScoreBar({ label, score = 0, explanation }) {
  const colors = score >= 90
    ? { bar: 'linear-gradient(90deg, #10b981 0%, #06b6d4 100%)', text: '#34d399' }
    : score >= 75
    ? { bar: 'linear-gradient(90deg, #059669 0%, #34d399 100%)', text: '#34d399' }
    : score >= 50
    ? { bar: 'linear-gradient(90deg, #d97706 0%, #fbbf24 100%)', text: '#fbbf24' }
    : { bar: 'linear-gradient(90deg, #e11d48 0%, #fb7185 100%)', text: '#f87171' };

  return (
    <div className="progress-bar-wrap">
      <div className="progress-bar-header">
        <span className="progress-bar-label">{label}</span>
        <span className="progress-bar-value" style={{ color: colors.text }}>{score} / 100</span>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${Math.min(100, Math.max(0, score))}%`, background: colors.bar }}
        />
      </div>
      {explanation && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.45 }}>{explanation}</p>
      )}
    </div>
  );
}
