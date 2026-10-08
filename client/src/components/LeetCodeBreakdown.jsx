import React, { useState } from 'react';
import { 
  Code2, Trophy, Award, CheckCircle, ExternalLink, 
  Flame, BookOpen, Layers, BarChart3, Clock, AlertCircle
} from 'lucide-react';

export function LeetCodeBreakdown({ data, url }) {
  const [topicFilter, setTopicFilter] = useState('all');

  if (!data || !data.extracted) {
    return (
      <div className="card">
        <div className="empty-state">
          <AlertCircle size={40} style={{ color: 'var(--yellow)' }} />
          <h3>LeetCode Profile Data Not Available</h3>
          <p>{data?.reason || 'Connect your LeetCode profile URL in your profile to view your problem-solving breakdown.'}</p>
          {url && (
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-secondary btn-sm" 
              style={{ marginTop: 12 }}
            >
              <ExternalLink size={14} /> Open LeetCode Profile
            </a>
          )}
        </div>
      </div>
    );
  }

  const {
    username,
    profile = {},
    totalSolved = 0,
    easySolved = 0,
    mediumSolved = 0,
    hardSolved = 0,
    ranking,
    acceptanceRate,
    submissionStats = {},
    languages = [],
    topics = [],
    contestRating = null,
    badges = [],
    recentSubmissions = []
  } = data;

  const total = totalSolved || 1;
  const easyPct = Math.round((easySolved / total) * 100);
  const medPct = Math.round((mediumSolved / total) * 100);
  const hardPct = Math.round((hardSolved / total) * 100);

  const filteredTopics = topicFilter === 'all' 
    ? topics 
    : topics.filter(t => t.category === topicFilter);

  return (
    <div className="anim-fade">
      {/* Header Profile Card */}
      <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(255, 179, 67, 0.08) 0%, rgba(22, 26, 34, 0.9) 100%)', border: '1px solid rgba(255, 179, 67, 0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ 
              width: 48, height: 48, borderRadius: 12, 
              background: 'linear-gradient(135deg, var(--horizon-amber) 0%, var(--horizon-coral) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(255, 179, 67, 0.24)'
            }}>
              <Code2 size={26} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{profile.realName || username}</h3>
                <span className="badge badge-accent" style={{ fontSize: '0.75rem' }}>@{username}</span>
                {contestRating?.badge && (
                  <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Flame size={12} /> {contestRating.badge}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {ranking && <span>Global Rank: #{ranking.toLocaleString()}</span>}
                {profile.school && <span>🎓 {profile.school}</span>}
                {profile.company && <span>💼 {profile.company}</span>}
                {profile.country && <span>📍 {profile.country}</span>}
              </div>
            </div>
          </div>

          <a 
            href={url || `https://leetcode.com/u/${username}/`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn btn-secondary btn-sm"
          >
            <ExternalLink size={14} /> View on LeetCode
          </a>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Total Solved
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
            {totalSolved}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            {acceptanceRate ? `${acceptanceRate}% Acceptance Rate` : 'Problems Solved'}
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center', borderTop: '3px solid var(--green)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Easy
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'Outfit' }}>
            {easySolved}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            {easyPct}% of total
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center', borderTop: '3px solid var(--yellow)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Medium
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--yellow)', fontFamily: 'Outfit' }}>
            {mediumSolved}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            {medPct}% of total
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center', borderTop: '3px solid var(--red)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--red)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Hard
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--red)', fontFamily: 'Outfit' }}>
            {hardSolved}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            {hardPct}% of total
          </div>
        </div>
      </div>

      {/* Contest & Badges Banner if available */}
      {contestRating && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Trophy size={18} style={{ color: 'var(--yellow)' }} /> Contest Performance
          </div>
          <div className="grid-4">
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Contest Rating</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--yellow)' }}>{contestRating.rating}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Global Ranking</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                {contestRating.globalRanking ? `#${contestRating.globalRanking.toLocaleString()}` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Top Percentage</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--green)' }}>{contestRating.topPercentage || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Attended Contests</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{contestRating.attendedContests}</div>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout: Languages & Topics */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Languages Solved */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Layers size={18} style={{ color: 'var(--accent-light)' }} /> Problems Solved by Language
          </div>
          {languages.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No language data reported.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {languages.map(lang => {
                const pct = Math.min(100, Math.round((lang.count / total) * 100));
                return (
                  <div key={lang.language}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{lang.language}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{lang.count}</strong> solved ({pct}%)
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${pct}%`, 
                          height: '100%', 
                          background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent-light) 100%)',
                          borderRadius: 3 
                        }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Badges & Recognition */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Award size={18} style={{ color: 'var(--yellow)' }} /> Earned Badges & Achievements
          </div>
          {badges.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No public badges found on this profile.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
              {badges.map((b, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    background: 'var(--bg-surface)', 
                    borderRadius: 10, 
                    padding: 12, 
                    textAlign: 'center', 
                    border: '1px solid var(--border)' 
                  }}
                >
                  {b.icon ? (
                    <img src={b.icon} alt={b.name} style={{ width: 44, height: 44, objectFit: 'contain', margin: '0 auto 8px' }} />
                  ) : (
                    <Award size={36} color="var(--yellow)" style={{ margin: '0 auto 8px' }} />
                  )}
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{b.name}</div>
                  {b.creationDate && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{b.creationDate}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Topics / Skills Matrix */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <BookOpen size={18} style={{ color: 'var(--blue)' }} /> Topic & Skill Tags Breakdown ({topics.length} topics)
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'fundamental', 'intermediate', 'advanced'].map(cat => (
              <button
                key={cat}
                onClick={() => setTopicFilter(cat)}
                className={`btn btn-sm ${topicFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.75rem', textTransform: 'capitalize', padding: '4px 10px' }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {filteredTopics.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No topic tags in this category.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {filteredTopics.map(t => {
              const tagColor = t.category === 'advanced' ? 'var(--red)' : (t.category === 'intermediate' ? 'var(--yellow)' : 'var(--blue)');
              const tagBg = t.category === 'advanced' ? 'var(--red-bg)' : (t.category === 'intermediate' ? 'var(--yellow-bg)' : 'var(--blue-bg)');
              return (
                <div 
                  key={t.name}
                  style={{
                    background: 'var(--bg-surface)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
                    <span 
                      style={{ 
                        fontSize: '0.68rem', 
                        color: tagColor, 
                        background: tagBg, 
                        padding: '1px 6px', 
                        borderRadius: 4, 
                        textTransform: 'capitalize',
                        display: 'inline-block',
                        marginTop: 2
                      }}
                    >
                      {t.category}
                    </span>
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
                    {t.count}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Submissions */}
      {recentSubmissions.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Clock size={18} style={{ color: 'var(--green)' }} /> Recent Problem Submissions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentSubmissions.map((sub, idx) => (
              <div 
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-surface)',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle size={16} style={{ color: 'var(--green)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{sub.title}</div>
                    {sub.timestamp && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(sub.timestamp).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {sub.language && (
                    <span className="badge badge-accent" style={{ fontSize: '0.72rem' }}>{sub.language}</span>
                  )}
                  {sub.titleSlug && (
                    <a
                      href={`https://leetcode.com/problems/${sub.titleSlug}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '3px 8px' }}
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
