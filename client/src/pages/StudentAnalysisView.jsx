import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { ScoreRing, ScoreBar } from '../components/ScoreComponents';
import { ClaimCard } from '../components/ClaimCard';
import { LeetCodeBreakdown } from '../components/LeetCodeBreakdown';
import { LinkedInBreakdown } from '../components/LinkedInBreakdown';
import { PortfolioBreakdown } from '../components/PortfolioBreakdown';
import { PersonalizedLearningRoadmap } from '../components/PersonalizedLearningRoadmap';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';

const SCORE_LABELS = {
  technicalSkills: 'Technical Skills',
  projectQuality: 'Project Quality',
  practicalImplementation: 'Practical Implementation',
  codingActivity: 'Coding Activity',
  roleFit: 'Role Fit',
  crossSourceConsistency: 'Cross-Source Consistency',
  ownershipAuthenticity: 'Ownership & Authenticity',
};

export default function StudentAnalysisView() {
  const { studentId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    api.get(`/placement/student-analysis/${studentId}`)
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (error) return (
    <div className="card">
      <div className="empty-state">
        <h3>Access Denied</h3>
        <p>{error}</p>
        <Link to="/placement/students" className="btn btn-secondary" style={{ marginTop: 16 }}>← Back to Students</Link>
      </div>
    </div>
  );

  const { student, analysis, history = [], personalizedSummary = null } = data;
  const scores = analysis?.scores || {};
  const claims = analysis?.claimValidation || [];
  const role = analysis?.roleAnalysis || {};
  const recs = analysis?.recommendations || {};
  const roadmap = analysis?.roadmap || {};
  const leetcodeData = analysis?.extractedData?.leetcode;
  const linkedinData = analysis?.extractedData?.linkedin;
  const portfolioData = analysis?.extractedData?.portfolio || (analysis?.sourceTexts?.portfolioText ? { extracted: true, plainTextSummary: analysis.sourceTexts.portfolioText } : null);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    ...(portfolioData ? [{ id: 'portfolio', label: 'Portfolio' }] : []),
    ...(leetcodeData ? [{ id: 'leetcode', label: `LeetCode (${leetcodeData.totalSolved ?? 0})` }] : []),
    ...(linkedinData ? [{ id: 'linkedin', label: 'LinkedIn' }] : []),
    { id: 'claims', label: 'Claims' },
    { id: 'scores', label: 'Scores' },
    { id: 'recommendations', label: 'Recommendations' },
    { id: 'roadmap', label: 'Roadmap' },
    ...(history.length > 0 ? [{ id: 'history', label: `Diagnostic History (${history.length})` }] : [])
  ];

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <Link to="/placement/students" className="btn btn-secondary btn-sm" style={{ marginBottom: 12 }}>
          <ArrowLeft size={14} /> Back to Students
        </Link>
        <h1 className="page-title">{student.name}</h1>
        <p className="page-subtitle">
          {student.email}{student.regNo ? ` · ${student.regNo}` : ''}{student.targetRole ? ` · Target: ${student.targetRole}` : ''}
          {student.approvedAt ? ` · Approved ${new Date(student.approvedAt).toLocaleDateString()}` : ''}
        </p>
      </div>

      {!analysis ? (
        <div className="card">
          <div className="empty-state">
            <h3>No analysis available</h3>
            <p>This student has not run an analysis yet.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Personalized Placement Summary Banner */}
          {personalizedSummary && (
            <div className="card anim-fade" style={{
              marginBottom: 20,
              background: 'linear-gradient(135deg, rgba(66, 114, 255, 0.12) 0%, rgba(14, 17, 24, 0.95) 100%)',
              border: '1px solid rgba(66, 114, 255, 0.35)',
              padding: '18px 20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--horizon-cyan)' }}>
                  Placement Cell Diagnostic Assessment
                </div>
                <span className={`badge ${personalizedSummary.readiness >= 70 ? 'badge-verified' : 'badge-partial'}`}>
                  Readiness: {personalizedSummary.readiness}/100
                </span>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {personalizedSummary.recommendationNote}
              </p>
              {personalizedSummary.nextAction && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--horizon-cyan)' }}>Recommended Next Action: </strong>
                  {personalizedSummary.nextAction}
                </div>
              )}
            </div>
          )}

          <div className="tabs">
            {tabs.map(t => (
              <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </div>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="anim-fade">
              <div className="grid-2" style={{ marginBottom: 24 }}>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div className="card-title" style={{ marginBottom: 20 }}>Overall Readiness</div>
                  <ScoreRing score={scores.overall || 0} size={160} />
                </div>
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 16 }}>Role Analysis</div>
                  {role.targetRole && <div style={{ fontWeight: 700, marginBottom: 12 }}>Target: {role.targetRole}</div>}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>STRENGTHS</div>
                    {(role.strengths || []).map((s, i) => (
                      <div key={i} style={{ fontSize: '0.82rem', color: 'var(--green-light)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>GAPS</div>
                    {(role.gaps || []).map((g, i) => (
                      <div key={i} style={{ fontSize: '0.82rem', color: 'var(--red-light)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <XCircle size={13} style={{ flexShrink: 0 }} />
                        <span>{g}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {roadmap.summary && (
                <div className="alert alert-info">{roadmap.summary}</div>
              )}
            </div>
          )}

          {tab === 'portfolio' && (
            <PortfolioBreakdown data={portfolioData} url={student.portfolioUrl || portfolioData?.url} />
          )}

          {tab === 'leetcode' && (
            <LeetCodeBreakdown data={leetcodeData} url={student.leetcodeUrl} />
          )}

          {tab === 'linkedin' && (
            <LinkedInBreakdown data={linkedinData} url={student.linkedinUrl} />
          )}

          {tab === 'claims' && (
            <div className="anim-fade">
              {claims.length === 0
                ? <div className="card"><div className="empty-state"><h3>No claims</h3></div></div>
                : claims.map((c, i) => <ClaimCard key={i} claim={c} />)
              }
            </div>
          )}

          {tab === 'scores' && (
            <div className="anim-fade card">
              <div className="card-title" style={{ marginBottom: 20 }}>Score Breakdown</div>
              {Object.entries(SCORE_LABELS).map(([key, label]) => {
                const s = scores[key];
                if (!s) return null;
                return <ScoreBar key={key} label={label} score={s.score || 0} explanation={s.explanation} />;
              })}
            </div>
          )}

          {tab === 'recommendations' && (
            <PersonalizedLearningRoadmap analysis={analysis} mode="recommendations" />
          )}

          {tab === 'roadmap' && (
            <PersonalizedLearningRoadmap analysis={analysis} mode="roadmap" />
          )}

          {tab === 'history' && (
            <div className="anim-fade card">
              <div className="card-title" style={{ marginBottom: 18 }}>Historical Diagnostics & Score Timeline</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {history.map((h, hIdx) => (
                  <div key={h.id || hIdx} style={{
                    background: 'var(--bg-surface)',
                    padding: '16px 18px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                          Evaluation {history.length - hIdx} · Score: {h.score}/100
                        </span>
                        {h.updatedFromProof && (
                          <span className="badge badge-verified" style={{ fontSize: '0.72rem' }}>
                            Updated from Proof
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {new Date(h.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      <strong>Target Role: </strong>{h.targetRole} · {h.verifiedCount} verified skills · {h.unsupportedCount} evidence gaps
                    </div>

                    {h.scoreChangeReason && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 6 }}>
                        <strong>Diagnostic Signal: </strong>{h.scoreChangeReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
