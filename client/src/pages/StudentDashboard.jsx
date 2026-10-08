import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { ScoreRing } from '../components/ScoreComponents';
import { BarChart3, User, FileText, AlertCircle, CheckCircle, Clock, ArrowRight } from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/dashboard')
      .then(r => setDash(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const profile = dash?.profile;
  const hasResume = !!profile?.resumePath;
  const hasGithub = !!profile?.githubUrl;
  const profileComplete = hasResume && hasGithub;
  const approvalStatus = profile?.approvalStatus;

  const steps = [
    { done: true, label: 'Account Created' },
    { done: profileComplete, label: 'Profile Complete' },
    { done: dash?.hasAnalysis, label: 'Analysis Run' },
  ];

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <h1 className="page-title">Welcome, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="page-subtitle">Your real-time career readiness command center</p>
      </div>

      {/* Approval banner */}
      {approvalStatus === 'pending' && (
        <div className="alert alert-info" style={{ marginBottom: 24 }}>
          <Clock size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Awaiting Placement Cell Approval: </strong>
            <span>You can continue using CareerLens normally — your data remains private until approved by your institution.</span>
          </div>
        </div>
      )}
      {approvalStatus === 'approved' && (
        <div className="alert alert-success" style={{ marginBottom: 24 }}>
          <CheckCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Verified Student Account: </strong>
            <span>Your profile is verified and active with your placement cell.</span>
          </div>
        </div>
      )}

      {/* Progress steps */}
      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, rgba(66, 114, 255, 0.08) 0%, rgba(20, 24, 36, 0.95) 100%)', border: '1px solid rgba(66, 234, 255, 0.22)' }}>
        <div className="card-header" style={{ marginBottom: 14 }}>
          <span className="card-title">Setup & Onboarding Milestones</span>
          <span className="badge badge-accent" style={{ fontSize: '0.75rem' }}>
            {steps.filter(s => s.done).length} of {steps.length} Complete
          </span>
        </div>
        <div className="steps-bar" style={{ marginBottom: 20 }}>
          {steps.map((s, i) => (
            <div key={i} className={`step-item ${s.done ? 'done' : i === steps.findIndex(x => !x.done) ? 'active' : ''}`}>
              <div className="step-circle">{s.done ? '✓' : i + 1}</div>
              <span className="step-label">{s.label}</span>
            </div>
          ))}
        </div>

        {!profileComplete && (
          <div style={{ textAlign: 'center', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <Link to="/profile" className="btn btn-primary btn-sm">
              Complete Profile Links <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Readiness Score</div>
          {dash?.overallScore != null
            ? <div className="stat-value" style={{ color: dash.overallScore >= 70 ? 'var(--green-light)' : 'var(--yellow-light)' }}>{dash.overallScore}</div>
            : <div className="stat-value" style={{ color: 'var(--text-muted)' }}>—</div>
          }
          <div className="stat-sub">{dash?.hasAnalysis ? 'From latest diagnostic' : 'Not yet analyzed'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Resume Status</div>
          <div className="stat-value" style={{ color: hasResume ? 'var(--green-light)' : 'var(--red-light)', fontSize: '1.35rem' }}>
            {hasResume ? '✓ Uploaded' : '✗ Missing'}
          </div>
          <div className="stat-sub">Mandatory source</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">GitHub Activity</div>
          <div className="stat-value" style={{ color: hasGithub ? 'var(--green-light)' : 'var(--red-light)', fontSize: '1.35rem' }}>
            {hasGithub ? '✓ Connected' : '✗ Missing'}
          </div>
          <div className="stat-sub">Code ownership proof</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Placement Cell</div>
          <div className="stat-value" style={{ fontSize: '1.05rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {profile?.placementCellId?.name || 'Institutional Cell'}
          </div>
          <div className="stat-sub" style={{ marginTop: 6 }}>
            <span className={`badge badge-${approvalStatus === 'approved' ? 'approved' : 'pending'}`}>
              {approvalStatus || 'pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="grid-2">
        {/* Analysis CTA or Score */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header">
              <span className="card-title">Job Readiness Diagnostic</span>
              <Link to="/analysis" className="btn btn-secondary btn-sm">
                {dash?.hasAnalysis ? 'View Full Breakdown' : 'Run Analysis'}
              </Link>
            </div>
            {dash?.hasAnalysis && dash.overallScore != null ? (
              <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
                <ScoreRing score={dash.overallScore} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: 12, maxWidth: 360, marginInline: 'auto' }}>
                  Derived from cross-source validation across your Resume, GitHub, LeetCode, and Portfolio.
                </p>
              </div>
            ) : (
              <div className="empty-state">
                <BarChart3 size={44} style={{ color: 'var(--accent-light)' }} />
                <h3>No analysis available</h3>
                <p>Complete your profile connections then run a diagnostic to get your personalized employability score.</p>
                {profileComplete && (
                  <Link to="/analysis" className="btn btn-primary" style={{ marginTop: 18 }}>
                    Run Analysis <ArrowRight size={15} />
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Link to="/profile" className="card card-interactive" style={{ display: 'flex', alignItems: 'center', gap: 16, textDecoration: 'none' }}>
            <div style={{ width: 46, height: 46, borderRadius: 'var(--radius-sm)', background: 'var(--accent-glow)', border: '1px solid rgba(99,102,241,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <User size={22} color="var(--accent-light)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', marginBottom: 3, color: 'var(--text-primary)' }}>Profile & External Links</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Manage Resume, GitHub, LeetCode, and Portfolio URLs</div>
            </div>
            <ArrowRight size={18} color="var(--text-muted)" />
          </Link>

          <Link to="/analysis" className="card card-interactive" style={{ display: 'flex', alignItems: 'center', gap: 16, textDecoration: 'none' }}>
            <div style={{ width: 46, height: 46, borderRadius: 'var(--radius-sm)', background: 'var(--green-bg)', border: '1px solid rgba(16,185,129,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BarChart3 size={22} color="var(--green-light)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', marginBottom: 3, color: 'var(--text-primary)' }}>Evidence-Based Analysis</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Personalized learning recommendations & timed roadmap</div>
            </div>
            <ArrowRight size={18} color="var(--text-muted)" />
          </Link>

          <Link to="/proof" className="card card-interactive" style={{ display: 'flex', alignItems: 'center', gap: 16, textDecoration: 'none' }}>
            <div style={{ width: 46, height: 46, borderRadius: 'var(--radius-sm)', background: 'var(--purple-bg)', border: '1px solid rgba(139,92,246,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileText size={22} color="var(--purple-light)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', marginBottom: 3, color: 'var(--text-primary)' }}>Proof of Work Submissions</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Submit verifiable repository links to resolve unsupported claims</div>
            </div>
            <ArrowRight size={18} color="var(--text-muted)" />
          </Link>
        </div>
      </div>
    </div>
  );
}
