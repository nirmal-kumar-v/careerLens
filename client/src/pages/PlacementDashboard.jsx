import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Users, Clock, CheckCircle, BarChart3, ArrowRight } from 'lucide-react';

export default function PlacementDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/placement/dashboard')
      .then(r => setStats(r.data.stats))
      .catch(() => {});
  }, []);

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <h1 className="page-title">Placement Cell Dashboard</h1>
        <p className="page-subtitle">{user?.institutionName || 'Your institution'} — {user?.name}</p>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-label">Total Students</div>
          <div className="stat-value">{stats?.totalStudents ?? '—'}</div>
          <div className="stat-sub">linked to your cell</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Approval</div>
          <div className="stat-value" style={{ color: 'var(--yellow)' }}>{stats?.pendingCount ?? '—'}</div>
          <div className="stat-sub">awaiting review</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{stats?.approvedCount ?? '—'}</div>
          <div className="stat-sub">actively monitored</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Analysed</div>
          <div className="stat-value" style={{ color: 'var(--accent-light)' }}>—</div>
          <div className="stat-sub">with full reports</div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid-2">
        <Link to="/placement/students" className="card card-interactive" style={{ textDecoration: 'none', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', background: 'var(--blue-bg)', border: '1px solid rgba(59,130,246,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={22} color="var(--blue-light)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 3, color: 'var(--text-primary)' }}>Manage Students & Approvals</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Review candidate profiles, verify links, and inspect diagnostic reports</div>
          </div>
          <ArrowRight size={18} color="var(--text-muted)" />
        </Link>

        <Link to="/placement/analytics" className="card card-interactive" style={{ textDecoration: 'none', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', background: 'var(--purple-bg)', border: '1px solid rgba(139,92,246,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart3 size={22} color="var(--purple-light)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 3, color: 'var(--text-primary)' }}>Cohort Analytics & Gap Radar</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Cross-student skill verification, claim vs proof ratios, score distributions</div>
          </div>
          <ArrowRight size={18} color="var(--text-muted)" />
        </Link>
      </div>

      {stats?.pendingCount > 0 && (
        <div className="alert alert-warning" style={{ marginTop: 24 }}>
          <Clock size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Action Required: </strong>
            <span>
              {stats.pendingCount} student{stats.pendingCount !== 1 ? 's' : ''} awaiting approval.{' '}
              <Link to="/placement/students" style={{ color: 'var(--yellow-light)', fontWeight: 700, textDecoration: 'underline' }}>Review candidate queue →</Link>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
