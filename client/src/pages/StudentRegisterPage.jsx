import { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Loader2, Eye, EyeOff, Briefcase } from 'lucide-react';

export default function StudentRegisterPage() {
  const { user, registerStudent } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '', regNo: '', placementCellId: ''
  });
  const [showPwd, setShowPwd] = useState(false);
  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/auth/placement-cells')
      .then(r => setCells(r.data))
      .catch(() => toast.error('Could not load placement cells'));
  }, []);

  if (user) {
    return <Navigate to={user.role === 'placement' ? '/placement/dashboard' : '/dashboard'} replace />;
  }

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.placementCellId) return toast.error('Please select a placement cell');
    setLoading(true);
    try {
      await registerStudent(form);
      toast.success('Account created! Welcome to CareerLens.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card anim-fade-up">
        <div className="auth-logo">
          <div className="logo-icon">
            <Briefcase size={20} color="#ffffff" />
          </div>
          <span className="logo-text">Career<span>Lens</span></span>
        </div>

        <h1 className="auth-title">Create student account</h1>
        <p className="auth-subtitle">Get your evidence-based employability analysis</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name <span className="required">*</span></label>
            <input className="form-input" name="name" placeholder="Jane Smith" value={form.name} onChange={handle} required />
          </div>

          <div className="form-group">
            <label className="form-label">Email <span className="required">*</span></label>
            <input className="form-input" type="email" name="email" placeholder="jane@college.edu" value={form.email} onChange={handle} autoComplete="email" required />
          </div>

          <div className="form-group">
            <label className="form-label">Registration Number <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(optional)</span></label>
            <input className="form-input" name="regNo" placeholder="e.g. 21CS001" value={form.regNo} onChange={handle} />
          </div>

          <div className="form-group">
            <label className="form-label">Password <span className="required">*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPwd ? 'text' : 'password'}
                name="password"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={handle}
                autoComplete="new-password"
                required
                style={{ paddingRight: 42 }}
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', color: 'var(--text-muted)', display: 'flex' }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Placement Cell <span className="required">*</span></label>
            <select className="form-select" name="placementCellId" value={form.placementCellId} onChange={handle} required>
              <option value="">— Select your institution's placement cell —</option>
              {cells.map(c => (
                <option key={c._id} value={c._id}>
                  {c.institutionName} — {c.name}
                </option>
              ))}
            </select>
            <span className="form-hint">Your data will only be shared after explicit approval.</span>
          </div>

          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
            {loading ? <><Loader2 size={17} /> Creating account…</> : 'Create Account'}
          </button>
        </form>

        <div className="auth-switch" style={{ marginTop: 20 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
