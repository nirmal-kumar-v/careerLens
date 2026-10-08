import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { ScoreRing, ScoreBar } from '../components/ScoreComponents';
import { ClaimCard } from '../components/ClaimCard';
import { LeetCodeBreakdown } from '../components/LeetCodeBreakdown';
import { LinkedInBreakdown } from '../components/LinkedInBreakdown';
import { PortfolioBreakdown } from '../components/PortfolioBreakdown';
import { PersonalizedLearningRoadmap } from '../components/PersonalizedLearningRoadmap';
import { Play, RefreshCw, BookOpen, FolderGit2, MapPin, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

const SCORE_LABELS = {
  technicalSkills: 'Technical Skills',
  projectQuality: 'Project Quality',
  practicalImplementation: 'Practical Implementation',
  codingActivity: 'Coding Activity',
  roleFit: 'Role Fit',
  crossSourceConsistency: 'Cross-Source Consistency',
  ownershipAuthenticity: 'Ownership & Authenticity',
};

export default function AnalysisPage() {
  const [analysis, setAnalysis] = useState(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    api.get('/student/analysis')
      .then(r => { if (r.data.exists) setAnalysis(r.data.analysis); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const runAnalysis = async () => {
    setRunning(true);
    toast('Running analysis — this may take 1–2 minutes…', { icon: '⚙️', duration: 8000 });
    try {
      const { data } = await api.post('/analysis/run');
      setAnalysis(data.evaluation ? { ...data.evaluation, status: 'complete' } : null);
      // Reload analysis from server
      const r = await api.get('/student/analysis');
      if (r.data.exists) setAnalysis(r.data.analysis);
      toast.success('Analysis complete!');
    } catch (err) {
      const sourceErrors = Object.entries(err.response?.data?.sourceErrors || {})
        .map(([source, message]) => `${source}: ${message}`)
        .join(' ');
      toast.error(sourceErrors || err.response?.data?.error || 'Analysis failed');
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const scores = analysis?.scores || {};
  const overall = scores.overall || 0;
  const claims = analysis?.claimValidation || [];
  const role = analysis?.roleAnalysis || {};
  const recs = analysis?.recommendations || {};
  const roadmap = analysis?.roadmap || {};
  const repositories = analysis?.extractedData?.github?.repositories || [];
  const leetcodeData = analysis?.extractedData?.leetcode;
  const linkedinData = analysis?.extractedData?.linkedin;
  const portfolioData = analysis?.extractedData?.portfolio || (analysis?.sourceTexts?.portfolioText ? { extracted: true, plainTextSummary: analysis.sourceTexts.portfolioText } : null);
  const claimedSkills = [...new Set([
    ...(analysis?.structuredEvidence?.claimedSkills || []),
    ...(analysis?.structuredEvidence?.claimedTechnologies || [])
  ])];

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'repositories', label: `GitHub Repositories (${repositories.length})` },
    ...(portfolioData ? [{ id: 'portfolio', label: 'Portfolio' }] : []),
    ...(leetcodeData ? [{ id: 'leetcode', label: `LeetCode (${leetcodeData.totalSolved ?? 0})` }] : []),
    ...(linkedinData ? [{ id: 'linkedin', label: 'LinkedIn' }] : []),
    { id: 'claims', label: `Claims (${claims.length})` },
    { id: 'scores', label: 'Score Breakdown' },
    { id: 'recommendations', label: 'Recommendations' },
    { id: 'roadmap', label: 'Roadmap' },
  ];

  return (
    <div className="anim-fade-up">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Career Analysis</h1>
          <p className="page-subtitle">Evidence-based employability evaluation</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={runAnalysis}
          disabled={running}
        >
          {running
            ? <><Loader2 size={16} className="spin-icon" /> Running…</>
            : analysis
            ? <><RefreshCw size={16} /> Re-analyze</>
            : <><Play size={16} /> Run Analysis</>
          }
        </button>
      </div>

      {running && (
        <div className="card" style={{ marginBottom: 28, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(15, 18, 25, 0.98) 100%)', border: '1px solid rgba(99, 102, 241, 0.3)', textAlign: 'center', padding: '48px 24px' }}>
          <div className="spinner" style={{ width: 44, height: 44, margin: '0 auto 20px', borderWidth: 3 }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: 8 }}>Synthesizing Candidate Evidence</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 520, margin: '0 auto', lineHeight: 1.5 }}>
            Extracting deep evidence across Resume, GitHub repositories, LeetCode, and Portfolio. Aligning proof against role benchmarks and generating personalized learning milestones.
          </p>
        </div>
      )}

      {!analysis && !running && (
        <div className="card">
          <div className="empty-state">
            <AlertCircle size={48} style={{ color: 'var(--accent-light)' }} />
            <h3>No analysis generated yet</h3>
            <p>Ensure your resume is uploaded and GitHub profile link is connected, then trigger a diagnostic evaluation.</p>
          </div>
        </div>
      )}

      {analysis && !running && (
        <>
          {/* Tabs */}
          <div className="tabs">
            {tabs.map(t => (
              <div key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
                {t.label}
              </div>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="anim-fade">
              <div className="grid-2" style={{ marginBottom: 24 }}>
                {/* Score ring */}
                <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div className="card-title" style={{ marginBottom: 18 }}>Overall Job Readiness</div>
                  <ScoreRing score={overall} size={156} />
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: 14, maxWidth: 380, marginInline: 'auto' }}>
                    {roadmap.summary || 'Score based on verified code evidence across all connected profiles.'}
                  </p>
                </div>

                {/* Role fit */}
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 16 }}>Target Role Alignment</div>
                  {role.targetRole && (
                    <div style={{ marginBottom: 16, background: 'var(--bg-surface)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>Target Role</span>
                      <div style={{ fontWeight: 700, fontSize: '1.15rem', marginTop: 2, color: 'var(--text-primary)' }}>{role.targetRole}</div>
                    </div>
                  )}
                  {role.strengths?.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>Verified Strengths</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {role.strengths.map((s, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            <span style={{ color: 'var(--green-light)', fontWeight: 700 }}>✓</span> {s}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {role.gaps?.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>Evidence Gaps</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {role.gaps.map((g, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <span style={{ color: 'var(--red-light)', fontWeight: 700 }}>✗</span> {g}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Suggested roles */}
              {role.suggestedRoles?.length > 0 && (
                <div className="card" style={{ marginBottom: 24 }}>
                  <div className="card-title" style={{ marginBottom: 16 }}>Best-Fit Roles Based on Evidence</div>
                  <div className="grid-3">
                    {role.suggestedRoles.map((r, i) => (
                      <div key={i} style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '16px', border: '1px solid var(--border)', transition: 'var(--transition-fast)' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.96rem', marginBottom: 6, color: 'var(--text-primary)' }}>{r.role}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div style={{ height: 6, flex: 1, background: 'var(--border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                            <div style={{ width: `${r.fitScore}%`, height: '100%', background: r.fitScore >= 70 ? 'var(--green-light)' : 'var(--yellow-light)', borderRadius: 'var(--radius-full)' }} />
                          </div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: r.fitScore >= 70 ? 'var(--green-light)' : 'var(--yellow-light)' }}>{r.fitScore}%</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{r.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mismatches */}
              {role.mismatches?.length > 0 && (
                <div className="alert alert-warning">
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Cross-Source Mismatches Detected:</strong>
                    <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                      {role.mismatches.map((m, i) => <li key={i} style={{ fontSize: '0.84rem', marginTop: 2 }}>{m}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Claims Tab */}
          {activeTab === 'repositories' && (
            <div className="anim-fade">
              <div className="card" style={{ marginBottom: 18 }}>
                <div className="card-title" style={{ marginBottom: 8 }}>Resume skills checked against GitHub</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                  {repositories.length} of {analysis?.extractedData?.github?.repositoriesAvailable ?? repositories.length} public repositories analyzed · Resume claims are matched against languages detected in each repository.
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                  {claimedSkills.map(skill => {
                    const matched = repositories.some(repo => Object.keys(repo.languages || {})
                      .some(language => normalizeSkill(language) === normalizeSkill(skill)));
                    return <span key={skill} className={`badge ${matched ? 'badge-verified' : 'badge-proof'}`}>
                      {skill}: {matched ? 'found on GitHub' : 'not found in analyzed repos'}
                    </span>;
                  })}
                </div>
              </div>
              {repositories.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {repositories.map(repo => {
                    const languages = Object.keys(repo.languages || {});
                    const matchingClaims = claimedSkills.filter(skill => languages
                      .some(language => normalizeSkill(language) === normalizeSkill(skill)));
                    return (
                      <article key={repo.url || repo.name} className="card" style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div>
                            <a href={repo.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontWeight: 700 }}>
                              {repo.name}<ExternalLink size={14} />
                            </a>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', margin: '5px 0 10px' }}>
                              {repo.description || 'No repository description provided.'}
                            </p>
                          </div>
                          <span className={`badge ${repo.isFork ? 'badge-partial' : 'badge-verified'}`}>
                            {repo.isFork ? 'Fork' : 'Original'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          {languages.length
                            ? languages.map(language => <span key={language} className="tag">{language}</span>)
                            : <span className="tag">Language not detected</span>}
                          {repo.topics?.map(topic => <span key={topic} className="tag">{topic}</span>)}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {repo.stargazersCount || 0} stars · Last updated {repo.pushedAt ? new Date(repo.pushedAt).toLocaleDateString() : 'unknown'}
                        </div>
                        <div style={{ marginTop: 8, fontSize: '0.82rem' }}>
                          {matchingClaims.length
                            ? `Resume skills found here: ${matchingClaims.join(', ')}`
                            : 'No listed resume skill was detected in this repository.'}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="card"><div className="empty-state"><h3>No repositories were returned</h3><p>Check that the GitHub profile is public and rerun the analysis.</p></div></div>
              )}
            </div>
          )}

          {/* Portfolio Tab */}
          {activeTab === 'portfolio' && (
            <PortfolioBreakdown 
              data={portfolioData} 
              url={analysis?.extractedData?.portfolio?.url} 
            />
          )}

          {/* LeetCode Tab */}
          {activeTab === 'leetcode' && (
            <LeetCodeBreakdown 
              data={leetcodeData} 
              url={analysis?.extractedData?.leetcode?.url} 
            />
          )}

          {/* LinkedIn Tab */}
          {activeTab === 'linkedin' && (
            <LinkedInBreakdown 
              data={linkedinData} 
              url={analysis?.extractedData?.linkedin?.url} 
            />
          )}

          {activeTab === 'claims' && (
            <div className="anim-fade">
              {analysis.proofRequests?.length > 0 && (
                <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                  <AlertCircle size={16} />
                  <div style={{ flex: 1 }}>
                    <strong>Evidence requested</strong>
                    {analysis.proofRequests.map((request, index) => (
                      <div key={`${request.skill}-${index}`} style={{ marginTop: 8 }}>
                        <div>{request.reason}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{request.suggestedProof}</div>
                        <Link to={`/proof?claim=${encodeURIComponent(request.skill)}`} className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}>
                          Submit proof for {request.skill}
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                {['verified', 'partially_supported', 'unsupported', 'requires_proof', 'not_verifiable'].map(status => {
                  const count = claims.filter(c => c.status === status).length;
                  if (count === 0) return null;
                  return (
                    <div key={status} className="stat-card" style={{ padding: '10px 16px', flex: 'none' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{count}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{status.replace(/_/g, ' ')}</div>
                    </div>
                  );
                })}
              </div>
              {claims.length === 0
                ? <div className="empty-state"><h3>No claims found</h3><p>Run analysis to see claim validation.</p></div>
                : claims.map((c, i) => <ClaimCard key={i} claim={c} />)
              }
            </div>
          )}

          {/* Score Breakdown Tab */}
          {activeTab === 'scores' && (
            <div className="anim-fade">
              <div className="grid-2">
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 20 }}>Score Breakdown</div>
                  {Object.entries(SCORE_LABELS).map(([key, label]) => {
                    const s = scores[key];
                    if (!s) return null;
                    return (
                      <ScoreBar
                        key={key}
                        label={label}
                        score={s.score || 0}
                        explanation={s.explanation}
                      />
                    );
                  })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {Object.entries(SCORE_LABELS).map(([key, label]) => {
                    const s = scores[key];
                    if (!s || !s.details) return null;
                    return (
                      <div key={key} className="card" style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 600, marginBottom: 10, fontSize: '0.9rem' }}>{label}</div>
                        {s.details.awarded && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--green)', marginBottom: 4 }}>
                            ✓ {s.details.awarded}
                          </div>
                        )}
                        {s.details.reduced && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--red)', marginBottom: 4 }}>
                            ✗ {s.details.reduced}
                          </div>
                        )}
                        {s.details.improve && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--yellow)' }}>
                            → {s.details.improve}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Recommendations Tab */}
          {activeTab === 'recommendations' && (
            <PersonalizedLearningRoadmap analysis={analysis} />
          )}

          {/* Roadmap Tab */}
          {activeTab === 'roadmap' && (
            <PersonalizedLearningRoadmap analysis={analysis} />
          )}
        </>
      )}
    </div>
  );
}

function normalizeSkill(skill) {
  return String(skill || '').toLowerCase().replace(/[^a-z0-9+#]/g, '');
}
