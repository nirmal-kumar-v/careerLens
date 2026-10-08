import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Loader2, Eye, EyeOff, Building2, Briefcase } from 'lucide-react';

export default function PlacementRegisterPage() {
  const { user, registerPlacement } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    institutionName: '', institutionCode: ''
  });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to={user.role === 'placement' ? '/placement/dashboard' : '/dashboard'} replace />;
  }

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await registerPlacement(form);
      toast.success('Placement cell registered!');
      navigate('/placement/dashboard', { replace: true });
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20, background: 'var(--blue-bg)', border: '1px solid rgba(66, 114, 255, 0.3)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
          <Building2 size={18} color="var(--horizon-cyan)" />
          <span style={{ fontSize: '0.85rem', color: 'var(--horizon-cyan)', fontWeight: 600 }}>Placement Cell Registration</span>
        </div>

        <h1 className="auth-title">Register your placement cell</h1>
        <p className="auth-subtitle">Monitor and evaluate your batch's employability</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Placement Cell Name <span className="required">*</span></label>
            <input className="form-input" name="name" placeholder="e.g. Training & Placement Office" value={form.name} onChange={handle} required />
          </div>

          <div className="form-group">
            <label className="form-label">Institution Name <span className="required">*</span></label>
            <input className="form-input" name="institutionName" placeholder="e.g. Indian Institute of Technology" value={form.institutionName} onChange={handle} required />
          </div>

          <div className="form-group">
            <label className="form-label">Institution Code <span className="required">*</span></label>
            <input className="form-input" name="institutionCode" placeholder="e.g. IIT-DEL or RVCE-21" value={form.institutionCode} onChange={handle} required />
          </div>

          <div className="form-group">
            <label className="form-label">Official Email <span className="required">*</span></label>
            <input className="form-input" type="email" name="email" placeholder="placement@institution.edu" value={form.email} onChange={handle} autoComplete="email" required />
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

          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
            {loading ? <><Loader2 size={17} /> Registering…</> : 'Register Placement Cell'}
          </button>
        </form>

        <div className="auth-switch" style={{ marginTop: 20 }}>
          Already registered? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
