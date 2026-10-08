import { useState } from 'react';
import { PlusCircle, Sparkles, CheckCircle2, FileCheck } from 'lucide-react';
import { AddProofModal } from './AddProofModal';

export function ClaimBadge({ status }) {
  const map = {
    verified: { cls: 'badge-verified', label: '✓ Verified' },
    supported: { cls: 'badge-verified', label: '✓ Supported' },
    partially_supported: { cls: 'badge-partial', label: '⚡ Partial Evidence' },
    unsupported: { cls: 'badge-unsupported', label: '✗ Unsupported' },
    requires_proof: { cls: 'badge-proof', label: '⚠ Needs Code Proof' },
    not_verifiable: { cls: 'badge-blue', label: '~ Not Verifiable' },
  };
  const { cls, label } = map[status] || { cls: 'badge-pending', label: status };
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function ClaimCard({ claim, analysisId, studentId, onProofAdded }) {
  const [showModal, setShowModal] = useState(false);

  const canAddProof = ['requires_proof', 'partially_supported'].includes(claim.status);

  return (
    <>
      <div 
        className="anim-fade-up"
        style={{
          background: 'var(--bg-surface)',
          border: claim.updatedFromProof ? '1px solid rgba(66, 234, 255, 0.35)' : '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '18px 20px',
          marginBottom: '14px',
          boxShadow: claim.updatedFromProof 
            ? 'var(--shadow-sm), 0 0 16px rgba(66, 234, 255, 0.08)' 
            : 'var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
          transition: 'var(--transition-fast)',
          position: 'relative'
        }}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {claim.skill}
            </span>
            {claim.updatedFromProof && (
              <span className="badge badge-verified" style={{ fontSize: '0.68rem', padding: '2px 7px', background: 'rgba(66, 234, 255, 0.15)', color: 'var(--cyan)' }}>
                <Sparkles size={11} style={{ marginRight: 3, verticalAlign: '-1px' }} />
                Updated from added proof
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClaimBadge status={claim.status} />

            {canAddProof && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="btn btn-secondary btn-sm"
                style={{
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  borderColor: 'rgba(66, 234, 255, 0.3)',
                  color: 'var(--cyan)'
                }}
              >
                <PlusCircle size={13} />
                Add Proof
              </button>
            )}
          </div>
        </div>

        {/* Personalized Claim Explanation */}
        {claim.explanation && (
          <div style={{
            fontSize: '0.88rem',
            color: 'var(--text-primary)',
            lineHeight: 1.55,
            marginBottom: '14px',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            borderLeft: claim.updatedFromProof ? '3px solid var(--cyan)' : '3px solid var(--accent)'
          }}>
            {claim.explanation}
          </div>
        )}

        {/* Evidence Details */}
        {claim.evidenceDetails && claim.evidenceDetails.length > 0 && (
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '10px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.04em' }}>
              Supporting Evidence Details
            </div>
            {claim.evidenceDetails.map((d, i) => (
              <div key={i} style={{ marginBottom: 6, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span className="tag" style={{ fontSize: '0.7rem', padding: '2px 8px', color: d.source === 'user_provided_proof' ? 'var(--cyan)' : 'var(--accent-light)', borderColor: d.source === 'user_provided_proof' ? 'rgba(66,234,255,0.3)' : 'rgba(99,102,241,0.25)', background: d.source === 'user_provided_proof' ? 'rgba(66,234,255,0.1)' : 'var(--accent-glow)' }}>
                  {d.source === 'user_provided_proof' ? 'user proof (pending validation)' : d.source}
                </span>
                <span>{d.detail}</span>
              </div>
            ))}
          </div>
        )}

        {/* Sources & Verification Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
          {claim.evidenceIn && claim.evidenceIn.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginRight: 4 }}>
                Sources:
              </span>
              {claim.evidenceIn.map(src => (
                <span key={src} className="tag" style={{ fontSize: '0.72rem' }}>
                  {src === 'user_proof' ? 'User-Provided Proof' : src}
                </span>
              ))}
            </div>
          ) : <div />}

          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
            Verification: Pending deeper ownership validation
          </span>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <AddProofModal
          claim={claim}
          analysisId={analysisId}
          studentId={studentId}
          onClose={() => setShowModal(false)}
          onSuccess={(result) => {
            if (onProofAdded) onProofAdded(result);
          }}
        />
      )}
    </>
  );
}
