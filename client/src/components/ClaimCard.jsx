export function ClaimBadge({ status }) {
  const map = {
    verified: { cls: 'badge-verified', label: '✓ Verified' },
    partially_supported: { cls: 'badge-partial', label: '⚡ Partial Evidence' },
    unsupported: { cls: 'badge-unsupported', label: '✗ Unsupported' },
    requires_proof: { cls: 'badge-proof', label: '⚠ Needs Code Proof' },
    not_verifiable: { cls: 'badge-blue', label: '~ Not Verifiable' },
  };
  const { cls, label } = map[status] || { cls: 'badge-pending', label: status };
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function ClaimCard({ claim }) {
  return (
    <div 
      className="anim-fade-up"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '18px 20px',
        marginBottom: '14px',
        boxShadow: 'var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        transition: 'var(--transition-fast)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '12px' }}>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          {claim.skill}
        </span>
        <ClaimBadge status={claim.status} />
      </div>

      {claim.evidenceDetails && claim.evidenceDetails.length > 0 && (
        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '10px' }}>
          {claim.evidenceDetails.map((d, i) => (
            <div key={i} style={{ marginBottom: 6, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="tag" style={{ fontSize: '0.7rem', padding: '2px 8px', color: 'var(--accent-light)', borderColor: 'rgba(99,102,241,0.25)', background: 'var(--accent-glow)' }}>
                {d.source}
              </span>
              <span>{d.detail}</span>
            </div>
          ))}
        </div>
      )}

      {claim.evidenceIn && claim.evidenceIn.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginRight: 4, alignSelf: 'center' }}>
            Sources:
          </span>
          {claim.evidenceIn.map(src => (
            <span key={src} className="tag" style={{ fontSize: '0.72rem' }}>
              {src}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
