export function ScoreRing({ score = 0, size = 148 }) {
  const strokeWidth = 10;
  const r = (size / 2) - strokeWidth;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  const gradientId = `score-grad-${score >= 90 ? 'horizon-top' : score >= 75 ? 'horizon-cyan' : score >= 50 ? 'horizon-amber' : 'horizon-coral'}`;
  
  const colors = score >= 90
    ? { start: '#4272FF', end: '#42EAFF', text: '#42EAFF', glow: 'rgba(66, 234, 255, 0.35)' }
    : score >= 75
    ? { start: '#4272FF', end: '#42EAFF', text: '#42EAFF', glow: 'rgba(66, 114, 255, 0.24)' }
    : score >= 50
    ? { start: '#FF7E42', end: '#FFB343', text: '#FFB343', glow: 'rgba(255, 179, 67, 0.3)' }
    : { start: '#FF7E42', end: '#FFB343', text: '#FF7E42', glow: 'rgba(255, 126, 66, 0.22)' };

  return (
    <div className="score-ring-wrap" style={{ width: size, height: size, filter: `drop-shadow(0 0 16px ${colors.glow})` }}>
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
    ? { bar: 'linear-gradient(90deg, #4272FF 0%, #42EAFF 100%)', text: '#42EAFF' }
    : score >= 75
    ? { bar: 'linear-gradient(90deg, #4272FF 0%, #42EAFF 100%)', text: '#42EAFF' }
    : score >= 50
    ? { bar: 'linear-gradient(90deg, #FF7E42 0%, #FFB343 100%)', text: '#FFB343' }
    : { bar: 'linear-gradient(90deg, #FF7E42 0%, #FFB343 100%)', text: '#FF7E42' };

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
