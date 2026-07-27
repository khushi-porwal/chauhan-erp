import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authApi } from '../api/index.js';
import { Lock, Key, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      return toast.error('Token is required');
    }
    if (newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters long');
    }
    if (newPassword !== confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setLoading(true);
    try {
      await authApi.resetPassword({ token, newPassword });
      toast.success('Password reset successful! Please login with your new password.');
      navigate('/login');
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to reset password. The token may be invalid or expired.';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh', width: '100vw', padding: 'var(--space-4)', background: 'var(--bg-base)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
          <Link to="/login" className="btn btn-ghost btn-icon" style={{ marginRight: 'auto' }}>
            <ArrowLeft size={16} />
          </Link>
          <div style={{ flex: 2, textAlign: 'center', marginRight: '36px' }}>
            <h2 className="text-primary font-bold">Reset Password</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="token">Reset Token</label>
            <div style={{ position: 'relative' }}>
              <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="token"
                type="text"
                className="form-input"
                placeholder="Enter reset token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                style={{ paddingLeft: '40px' }}
                required
              />
            </div>
            <p className="form-hint">Paste the token received from the forgot password request</p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="newPassword">New Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="newPassword"
                type="password"
                className="form-input"
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ paddingLeft: '40px' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="confirmPassword"
                type="password"
                className="form-input"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ paddingLeft: '40px' }}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary flex-center"
            style={{ width: '100%', marginTop: 'var(--space-2)', padding: 'var(--space-3)' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Saving Password...
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
