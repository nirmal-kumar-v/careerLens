import React from 'react';
import { 
  Code2, Trophy, Award, CheckCircle, ExternalLink, 
  BookOpen, Layers, BarChart3, Clock, AlertCircle, Terminal, Cpu
} from 'lucide-react';

export function GeeksforGeeksBreakdown({ data, url }) {
  if (!data || !data.extracted) {
    return (
      <div className="card">
        <div className="empty-state">
          <AlertCircle size={40} style={{ color: 'var(--horizon-orange)' }} />
          <h3>GeeksforGeeks Profile Data Not Available</h3>
          <p>{data?.reason || 'Connect your GeeksforGeeks profile URL in your profile to view your problem-solving metrics.'}</p>
          {url && (
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-secondary btn-sm" 
              style={{ marginTop: 12 }}
            >
              <ExternalLink size={14} /> Open GeeksforGeeks Profile
            </a>
          )}
        </div>
      </div>
    );
  }

  const {
    username,
    name,
    headline,
    totalProblemsSolved,
    codingScore,
    monthlyScore,
    problemsByDifficulty = {},
    languages = []
  } = data;

  const profileUrl = url || (username ? `https://www.geeksforgeeks.org/user/${username}/` : null);

  const diff = problemsByDifficulty || {};
  const hasDifficultyBreakdown = Object.keys(diff).length > 0 && Object.values(diff).some(v => v > 0);

  const diffItems = [
    { label: 'School', count: diff.school, color: 'var(--text-muted)' },
    { label: 'Basic', count: diff.basic, color: 'var(--horizon-cyan)' },
    { label: 'Easy', count: diff.easy, color: 'var(--green-light)' },
    { label: 'Medium', count: diff.medium, color: 'var(--horizon-orange)' },
    { label: 'Hard', count: diff.hard, color: 'var(--horizon-coral)' }
  ].filter(d => d.count !== undefined);

  return (
    <div className="anim-fade">
      {/* Header Profile Card */}
      <div className="card" style={{ 
        marginBottom: 20, 
        background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.08) 0%, rgba(22, 26, 34, 0.95) 100%)', 
        border: '1px solid rgba(46, 204, 113, 0.25)' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ 
              width: 48, height: 48, borderRadius: 12, 
              background: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(46, 204, 113, 0.25)'
            }}>
              <Terminal size={26} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                  {name || username || 'GeeksforGeeks Practitioner'}
                </h3>
                {username && (
                  <span className="badge badge-accent" style={{ fontSize: '0.75rem' }}>
                    @{username}
                  </span>
                )}
                <span className="badge badge-verified" style={{ fontSize: '0.72rem' }}>
                  Verified Profile
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {headline && <span>🏛️ {headline}</span>}
                {codingScore !== undefined && <span>Coding Score: {codingScore}</span>}
              </div>
            </div>
          </div>

          {profileUrl && (
            <a 
              href={profileUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-secondary btn-sm" 
            >
              <ExternalLink size={14} /> View on GeeksforGeeks
            </a>
          )}
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Total Solved
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
            {totalProblemsSolved !== undefined ? totalProblemsSolved : 'Not available'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Problems Solved
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center', borderTop: '3px solid #2ecc71' }}>
          <div style={{ fontSize: '0.75rem', color: '#2ecc71', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Coding Score
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#2ecc71', fontFamily: 'Outfit' }}>
            {codingScore !== undefined ? codingScore : 'Not available'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Platform Practice Score
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center', borderTop: '3px solid var(--horizon-cyan)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--horizon-cyan)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Monthly Score
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--horizon-cyan)', fontFamily: 'Outfit' }}>
            {monthlyScore !== undefined ? monthlyScore : 'Not available'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Current Month Score
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center', borderTop: '3px solid var(--horizon-orange)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--horizon-orange)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Languages
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--horizon-orange)', fontFamily: 'Outfit' }}>
            {languages.length > 0 ? languages.length : 'Not available'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Active Languages
          </div>
        </div>
      </div>

      {/* Difficulty Breakdown (if available) */}
      {hasDifficultyBreakdown && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BarChart3 size={18} style={{ color: '#2ecc71' }} /> Problems by Difficulty
          </div>
          <div className="grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
            {diffItems.map(d => (
              <div key={d.label} style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                border: '1px solid var(--border)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.74rem', color: d.color, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                  {d.label}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: d.color, marginTop: 4, fontFamily: 'Outfit' }}>
                  {d.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Practiced Languages Section */}
      {languages.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Cpu size={18} style={{ color: 'var(--horizon-cyan)' }} /> Practiced Languages & Technologies
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {languages.map(lang => (
              <span key={lang} className="tag" style={{
                background: 'rgba(46, 204, 113, 0.1)',
                borderColor: 'rgba(46, 204, 113, 0.3)',
                color: '#2ecc71',
                padding: '6px 14px',
                fontSize: '0.85rem'
              }}>
                {lang}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Integration Summary Card */}
      <div className="card" style={{ 
        background: 'rgba(255, 255, 255, 0.02)', 
        border: '1px solid var(--border)' 
      }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <CheckCircle size={18} style={{ color: 'var(--green-light)' }} /> Evidence Integration Details
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          GeeksforGeeks problem solving metrics serve as direct supporting evidence for Data Structures, Algorithms, and coding practice. Verified practice metrics corroborate technical skills in the Job Readiness Score and validate DSA claims without requiring separate repository code.
        </p>
      </div>
    </div>
  );
}
