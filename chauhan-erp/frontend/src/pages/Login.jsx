import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Lock, Mail, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      return toast.error('Please enter email and password');
    }
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back to Chauhan ERP!');
      navigate('/');
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Invalid email or password';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh', width: '100vw', padding: 'var(--space-4)', background: 'var(--bg-base)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
          <div className="logo-icon" style={{ margin: '0 auto var(--space-3) auto', width: '48px', height: '48px', fontSize: '20px' }}>C</div>
          <h2 className="text-primary font-bold">Chauhan ERP</h2>
          <p className="text-muted text-sm">Sign in to your enterprise suite</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="superadmin@chauhanerp.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '40px' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div className="flex-between">
              <label className="form-label" htmlFor="password">Password</label>
              <Link to="/forgot-password" className="text-xs" style={{ color: 'var(--primary)' }}>
                Forgot Password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-2)' }}>
          <p className="text-muted text-xs">
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
