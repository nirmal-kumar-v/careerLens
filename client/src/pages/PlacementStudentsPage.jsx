import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle, Clock, User, BarChart3, Loader2 } from 'lucide-react';

const STATUS_TAB = ['all', 'pending', 'approved', 'rejected'];

export default function PlacementStudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [tab, setTab] = useState('all');

  const load = () => {
    api.get('/placement/students')
      .then(r => setStudents(r.data))
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const approve = async (id) => {
    setActionId(id);
    try {
      await api.post(`/placement/approve/${id}`);
      toast.success('Student approved');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve');
    } finally {
      setActionId(null);
    }
  };

  const reject = async (id) => {
    setActionId(id);
    try {
      await api.post(`/placement/reject/${id}`);
      toast.success('Student rejected');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject');
    } finally {
      setActionId(null);
    }
  };

  const filtered = tab === 'all' ? students : students.filter(s => s.approvalStatus === tab);

  const badgeCls = {
    pending: 'badge-pending',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
  };

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <h1 className="page-title">Students</h1>
        <p className="page-subtitle">Manage students linked to your placement cell</p>
      </div>

      {/* Tab filter */}
      <div className="tabs" style={{ maxWidth: 400 }}>
        {STATUS_TAB.map(t => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span style={{ marginLeft: 5, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              ({t === 'all' ? students.length : students.filter(s => s.approvalStatus === t).length})
            </span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <User size={44} />
            <h3>No students found</h3>
            <p>Students who select your placement cell during registration will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Reg. No</th>
                  <th>Target Role</th>
                  <th>Profile</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.email}</div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.regNo || '—'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{s.targetRole || <span style={{ color: 'var(--text-muted)' }}>Not set</span>}</td>
                    <td>
                      <span className={`badge ${s.profileComplete ? 'badge-approved' : 'badge-pending'}`}>
                        {s.profileComplete ? 'Complete' : 'Incomplete'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${badgeCls[s.approvalStatus] || 'badge-pending'}`}>
                        {s.approvalStatus}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {s.approvalStatus === 'pending' && (
                          <>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => approve(s.id)}
                              disabled={actionId === s.id}
                            >
                              {actionId === s.id ? <Loader2 size={13} /> : <CheckCircle size={13} />}
                              Approve
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => reject(s.id)}
                              disabled={actionId === s.id}
                            >
                              <XCircle size={13} /> Reject
                            </button>
                          </>
                        )}
                        {s.approvalStatus === 'approved' && (
                          <Link to={`/placement/students/${s.id}`} className="btn btn-secondary btn-sm">
                            <BarChart3 size={13} /> View Analysis
                          </Link>
                        )}
                        {s.approvalStatus === 'rejected' && (
                          <button className="btn btn-success btn-sm" onClick={() => approve(s.id)}>
                            Re-approve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
