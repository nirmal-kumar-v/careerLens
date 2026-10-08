import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { ScoreRing, ScoreBar } from '../components/ScoreComponents';
import { ClaimCard } from '../components/ClaimCard';
import { LeetCodeBreakdown } from '../components/LeetCodeBreakdown';
import { LinkedInBreakdown } from '../components/LinkedInBreakdown';
import { PortfolioBreakdown } from '../components/PortfolioBreakdown';
import { PersonalizedLearningRoadmap } from '../components/PersonalizedLearningRoadmap';
import { ArrowLeft } from 'lucide-react';

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

  const { student, analysis } = data;
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
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>STRENGTHS</div>
                    {(role.strengths || []).map((s, i) => <div key={i} style={{ fontSize: '0.82rem', color: 'var(--green)', marginBottom: 3 }}>✓ {s}</div>)}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>GAPS</div>
                    {(role.gaps || []).map((g, i) => <div key={i} style={{ fontSize: '0.82rem', color: 'var(--red)', marginBottom: 3 }}>✗ {g}</div>)}
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
            <PersonalizedLearningRoadmap analysis={analysis} />
          )}

          {tab === 'roadmap' && (
            <PersonalizedLearningRoadmap analysis={analysis} />
          )}
        </>
      )}
    </div>
  );
}
