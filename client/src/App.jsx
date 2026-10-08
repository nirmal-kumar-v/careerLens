import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';

// Auth pages
import LoginPage from './pages/LoginPage';
import StudentRegisterPage from './pages/StudentRegisterPage';
import PlacementRegisterPage from './pages/PlacementRegisterPage';

// Student pages
import StudentDashboard from './pages/StudentDashboard';
import ProfilePage from './pages/ProfilePage';
import AnalysisPage from './pages/AnalysisPage';
import ProofPage from './pages/ProofPage';

// Placement pages
import PlacementDashboard from './pages/PlacementDashboard';
import PlacementStudentsPage from './pages/PlacementStudentsPage';
import StudentAnalysisView from './pages/StudentAnalysisView';
import PlacementAnalyticsPage from './pages/PlacementAnalyticsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: '0.875rem',
            }
          }}
        />
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register/student" element={<StudentRegisterPage />} />
          <Route path="/register/placement" element={<PlacementRegisterPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Student routes */}
          <Route element={<ProtectedRoute role="student"><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<StudentDashboard />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/proof" element={<ProofPage />} />
          </Route>

          {/* Placement routes */}
          <Route element={<ProtectedRoute role="placement"><AppLayout /></ProtectedRoute>}>
            <Route path="/placement/dashboard" element={<PlacementDashboard />} />
            <Route path="/placement/students" element={<PlacementStudentsPage />} />
            <Route path="/placement/students/:studentId" element={<StudentAnalysisView />} />
            <Route path="/placement/analytics" element={<PlacementAnalyticsPage />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
