import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/index.js';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resetToken, setResetToken] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      return toast.error('Please enter your email address');
    }
    setLoading(true);
    try {
      const res = await authApi.forgotPassword({ email });
      const token = res.data?.data?.resetToken || '';
      if (token) {
        setResetToken(token);
      }
      setSubmitted(true);
      toast.success('Password reset link generated successfully!');
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Error processing request. Please try again.';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh', width: '100vw', padding: 'var(--space-4)', background: 'var(--bg-base)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
          <Link to="/login" className="btn btn-ghost btn-icon" style={{ marginRight: 'auto' }}>
            <ArrowLeft size={16} />
          </Link>
          <div style={{ flex: 2, textAlign: 'center', marginRight: '36px' }}>
            <h2 className="text-primary font-bold">Forgot Password</h2>
          </div>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p className="text-secondary text-sm">
              Password reset link has been processed for <strong>{email}</strong>.
            </p>

            {resetToken ? (
              <div style={{
                background: 'var(--bg-elevated)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <span className="text-xs font-semibold text-primary">Generated Reset Token:</span>
                <code style={{ fontSize: '0.75rem', wordBreak: 'break-all', color: 'var(--accent)', background: 'var(--bg-card)', padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}>
                  {resetToken}
                </code>
                <Link
                  to={`/reset-password?token=${resetToken}`}
                  className="btn btn-primary flex-center"
                  style={{ width: '100%', marginTop: '6px', padding: '10px' }}
                >
                  Proceed to Reset Password
                </Link>
              </div>
            ) : (
              <p className="text-muted text-xs">
                Please check your inbox for instructions to reset your password.
              </p>
            )}

            <Link to="/login" className="btn btn-secondary flex-center" style={{ width: '100%', padding: 'var(--space-3)' }}>
              Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p className="text-secondary text-sm" style={{ textAlign: 'center' }}>
              Enter your email address and we'll send you a token to reset your password.
            </p>

            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="yourname@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  Sending Token...
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
