import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/index.js';
import { User, Mail, Lock, Shield, Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    module: 'finance',
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      return toast.error('Please fill in all required fields');
    }
    if (formData.password.length < 6) {
      return toast.error('Password must be at least 6 characters long');
    }
    if (formData.password !== formData.confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setLoading(true);
    try {
      await authApi.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        module: formData.module,
      });
      toast.success('Account created successfully! Please sign in.');
      navigate('/login');
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Registration failed. Please try again.';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh', width: '100vw', padding: 'var(--space-4)', background: 'var(--bg-base)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
          <div className="logo-icon" style={{ margin: '0 auto var(--space-3) auto', width: '48px', height: '48px', fontSize: '20px' }}>C</div>
          <h2 className="text-primary font-bold">Create Account</h2>
          <p className="text-muted text-sm">Sign up for Chauhan ERP platform access</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Full Name *</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="name"
                name="name"
                type="text"
                className="form-input"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                style={{ paddingLeft: '40px' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address *</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="email"
                name="email"
                type="email"
                className="form-input"
                placeholder="user@chauhanerp.com"
                value={formData.email}
                onChange={handleChange}
                style={{ paddingLeft: '40px' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="module">Assigned Module / Department *</label>
            <div style={{ position: 'relative' }}>
              <Shield size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <select
                id="module"
                name="module"
                className="form-select"
                value={formData.module}
                onChange={handleChange}
                style={{ paddingLeft: '40px' }}
              >
                <option value="finance">Finance (Payment In/Out, Ledgers, Expenses)</option>
                <option value="sales">Sales & Retail (Invoices, Orders, POS, Customers)</option>
                <option value="purchases">Purchases (Orders, Supplier Bills, Vendors)</option>
                <option value="inventory">Inventory & Products (Stock, Warehouses, Catalog)</option>
                <option value="reports">Reports & Analytics</option>
                <option value="admin">ERP Admin (Full Access to All Modules)</option>
              </select>
            </div>
            <p className="form-hint" style={{ fontSize: '0.7rem', marginTop: '4px' }}>
              Non-admin accounts will strictly see only their assigned department's data.
            </p>
          </div>

          <div className="grid-2" style={{ gap: 'var(--space-3)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password *</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm Password *</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
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
                Creating Account...
              </>
            ) : (
              <>
                Complete Sign Up <ArrowRight size={16} style={{ marginLeft: '6px' }} />
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-2)' }}>
          <p className="text-muted text-xs">
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
