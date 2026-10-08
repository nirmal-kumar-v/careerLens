import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('cl_token');
    if (token) {
      api.get('/auth/me')
        .then(({ data }) => { setUser(data.user); setProfile(data.profile); })
        .catch(() => localStorage.removeItem('cl_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('cl_token', data.token);
    setUser(data.user);
    setProfile(data.profile);
    return data;
  };

  const registerStudent = async (form) => {
    const { data } = await api.post('/auth/register/student', form);
    localStorage.setItem('cl_token', data.token);
    setUser(data.user);
    setProfile(data.profile);
    return data;
  };

  const registerPlacement = async (form) => {
    const { data } = await api.post('/auth/register/placement', form);
    localStorage.setItem('cl_token', data.token);
    setUser(data.user);
    setProfile(null);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('cl_token');
    setUser(null);
    setProfile(null);
    window.location.href = '/login';
  };

  const refreshProfile = async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    setProfile(data.profile);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, registerStudent, registerPlacement, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
