import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, User, BarChart3, FileText,
  Users, CheckSquare, TrendingUp, LogOut, Briefcase
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isStudent = user?.role === 'student';

  const studentLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/profile', icon: User, label: 'My Profile' },
    { to: '/analysis', icon: BarChart3, label: 'Analysis' },
    { to: '/proof', icon: FileText, label: 'Proof of Work' },
  ];

  const placementLinks = [
    { to: '/placement/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/placement/students', icon: Users, label: 'Students' },
    { to: '/placement/analytics', icon: TrendingUp, label: 'Batch Analytics' },
  ];

  const links = isStudent ? studentLinks : placementLinks;

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-icon">
          <Briefcase size={20} color="#ffffff" />
        </div>
        <div className="logo-text">Career<span>Lens</span></div>
      </div>

      <nav className="nav-section">
        <div className="nav-section-label">
          {isStudent ? 'Student Workspace' : 'Placement Command'}
        </div>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-badge" onClick={logout} title="Click to Sign Out">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.name || 'Candidate'}</div>
            <div className="user-role">{isStudent ? 'Student Account' : 'Placement Officer'}</div>
          </div>
          <LogOut size={16} color="var(--text-muted)" style={{ transition: 'color 0.15s ease' }} />
        </div>
      </div>
    </aside>
  );
}
