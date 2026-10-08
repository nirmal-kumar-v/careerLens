import { useEffect, useState } from 'react';
import api from '../api/axios';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend
} from 'recharts';
import { TrendingDown, Users, BarChart3, AlertTriangle } from 'lucide-react';

const COLORS = ['#4272FF', '#42EAFF', '#FFB343', '#FF7E42'];

export default function PlacementAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/placement/analytics')
      .then(r => setAnalytics(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const summary = analytics?.summary || {};
  const claimVsProof = analytics?.claimVsProof || [];
  const commonGaps = analytics?.commonGaps || [];
  const roles = analytics?.roleDistribution || [];
  const scores = analytics?.scoreDistribution || [];

  // Score histogram buckets
  const scoreBuckets = [
    { label: '0–20', count: scores.filter(s => s <= 20).length },
    { label: '21–40', count: scores.filter(s => s > 20 && s <= 40).length },
    { label: '41–60', count: scores.filter(s => s > 40 && s <= 60).length },
    { label: '61–80', count: scores.filter(s => s > 60 && s <= 80).length },
    { label: '81–100', count: scores.filter(s => s > 80).length },
  ];

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <h1 className="page-title">Batch Analytics</h1>
        <p className="page-subtitle">Insights from approved students only</p>
      </div>

      {summary.totalApproved === 0 ? (
        <div className="card">
          <div className="empty-state">
            <BarChart3 size={44} />
            <h3>No data yet</h3>
            <p>Analytics will appear once you have approved students who have run their analysis.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid-4" style={{ marginBottom: 28 }}>
            <div className="stat-card">
              <div className="stat-label">Total Students</div>
              <div className="stat-value">{summary.totalStudents}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Approved</div>
              <div className="stat-value" style={{ color: 'var(--green)' }}>{summary.totalApproved}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Analysed</div>
              <div className="stat-value" style={{ color: 'var(--accent-light)' }}>{summary.totalAnalyzed}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg. Readiness Score</div>
              <div className="stat-value" style={{ color: summary.averageScore >= 60 ? 'var(--green)' : 'var(--yellow)' }}>
                {summary.averageScore || '—'}
              </div>
            </div>
          </div>

          {/* Claim vs Proof */}
          {claimVsProof.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <span className="card-title">
                  <TrendingDown size={16} style={{ display: 'inline', marginRight: 6 }} />
                  Claim vs. Proof Gap (Top 15 Skills)
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                Percentage of students who claimed vs. actually demonstrated each skill.
              </p>
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={claimVsProof.slice(0, 15)} layout="vertical" margin={{ left: 80 }}>
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <YAxis type="category" dataKey="skill" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={76} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                      formatter={(val, name) => [`${val}%`, name === 'claimRate' ? 'Claimed' : 'Verified']}
                    />
                    <Bar dataKey="claimRate" name="Claimed" fill="#4272FF" opacity={0.78} radius={[0,4,4,0]} />
                    <Bar dataKey="verifyRate" name="Verified" fill="#42EAFF" opacity={0.85} radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div className="table-wrap" style={{ marginTop: 20 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Skill</th>
                      <th>Students Claimed</th>
                      <th>Verified</th>
                      <th>Claim Rate</th>
                      <th>Verify Rate</th>
                      <th>Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claimVsProof.slice(0, 15).map((item, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{item.skill}</td>
                        <td>{item.claimed}</td>
                        <td>{item.verified}</td>
                        <td>{item.claimRate}%</td>
                        <td style={{ color: item.verifyRate >= 60 ? 'var(--green)' : 'var(--yellow)' }}>{item.verifyRate}%</td>
                        <td>
                          <span className={`badge ${item.gap > 3 ? 'badge-unsupported' : item.gap > 1 ? 'badge-partial' : 'badge-verified'}`}>
                            {item.gap} students
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid-2">
            {/* Common gaps */}
            {commonGaps.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">
                    <AlertTriangle size={15} style={{ display: 'inline', marginRight: 6 }} />
                    Common Batch Gaps
                  </span>
                </div>
                {commonGaps.map((g, i) => (
                  <div key={i} className="progress-bar-wrap">
                    <div className="progress-bar-header">
                      <span className="progress-bar-label" style={{ fontSize: '0.82rem' }}>{g.gap}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{g.count} students ({g.percentage}%)</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${g.percentage}%`, background: 'var(--red)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Role distribution */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {roles.length > 0 && (
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 16 }}>Target Role Distribution</div>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={roles} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={80} label={({ role, percent }) => `${role} (${(percent * 100).toFixed(0)}%)`}>
                          {roles.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Score distribution */}
              {scores.length > 0 && (
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 16 }}>Readiness Score Distribution</div>
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={scoreBuckets}>
                        <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                        <Bar dataKey="count" name="Students" fill="#4272FF" radius={[4,4,0,0]}>
                          {scoreBuckets.map((b, i) => (
                            <Cell key={i} fill={i >= 3 ? '#42EAFF' : i >= 2 ? '#FFB343' : '#FF7E42'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
