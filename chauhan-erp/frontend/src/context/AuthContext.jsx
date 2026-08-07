import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('accessToken'));
  const [loading, setLoading] = useState(true);

  // Restore session on page reload
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('erp_user');
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setAccessToken(token);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('erp_user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password });
    const { user: userData, accessToken: token } = res.data.data;
    localStorage.setItem('accessToken', token);
    localStorage.setItem('erp_user', JSON.stringify(userData));
    setUser(userData);
    setAccessToken(token);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('erp_user');
    setUser(null);
    setAccessToken(null);
  }, []);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role);
  const isBranchManager = user?.role === 'BRANCH_MANAGER';
  const isUser = user?.role === 'USER';

  // Granular permission check – works for both role-based and permission-array-based access
  const hasPermission = (permKey) => {
    if (isSuperAdmin || isAdmin) return true; // Admins see everything
    const perms = Array.isArray(user?.permissions)
      ? user.permissions
      : (typeof user?.permissions === 'string' ? JSON.parse(user?.permissions || '[]') : []);
    return perms.includes(permKey);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, logout, isSuperAdmin, isAdmin, isBranchManager, isUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
