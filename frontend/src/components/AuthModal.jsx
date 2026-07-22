import React, { useState } from 'react';

const RECOVERY_QUESTIONS = [
  "What is your pet's name?",
  "What was the name of your first school?",
  "In what city were you born?",
  "What is your mother's maiden name?",
  "What is your favorite sports team?"
];

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [authView, setAuthView] = useState('login'); // 'login', 'register', 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Password Recovery States
  const [recoveryQuestion, setRecoveryQuestion] = useState(RECOVERY_QUESTIONS[0]);
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1 = enter email, 2 = answer & reset
  const [fetchedQuestion, setFetchedQuestion] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Show/Hide Password States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);


  if (!isOpen) return null;

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (authView === 'register') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!recoveryAnswer.trim()) {
        setError('Please provide an answer to the recovery question.');
        return;
      }
    }

    setIsLoading(true);
    const endpoint = authView === 'register' ? '/api/auth/register' : '/api/auth/login';
    const payload = authView === 'register' ? {
      email,
      password,
      recovery_question: recoveryQuestion,
      recovery_answer: recoveryAnswer
    } : { email, password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed. Please try again.');
      }

      if (authView === 'register') {
        setSuccessMessage('Account created successfully! Please sign in below.');
        setAuthView('login');
        setPassword('');
        setConfirmPassword('');
        setRecoveryAnswer('');
      } else {
        // Save credentials to localStorage
        localStorage.setItem('fitvibe_token', data.token);
        localStorage.setItem('fitvibe_email', data.email);

        // Trigger callback to update App state
        onAuthSuccess(data.token, data.email);
        onClose();
        
        // Reset forms
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email.trim() || !recoveryAnswer.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          question: recoveryQuestion,
          answer: recoveryAnswer.trim(),
          new_password: newPassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Password reset failed.');
      }

      setSuccessMessage('Password reset successfully! Please sign in with your new password.');
      setAuthView('login');
      setPassword('');
      setConfirmPassword('');
      setRecoveryAnswer('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(3, 7, 18, 0.8)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      animation: 'fadeInUp 0.3s ease-out'
    }}>
      <div 
        className="glass-panel neon-glow-card" 
        style={{
          width: '100%',
          maxWidth: '420px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '2.5rem',
          position: 'relative',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
        }}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '1.5rem',
            cursor: 'pointer',
            transition: 'var(--transition-fast)'
          }}
          onMouseEnter={(e) => e.target.style.color = 'var(--color-accent)'}
          onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
        >
          &times;
        </button>

        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.85rem',
          fontWeight: 800,
          marginBottom: '0.5rem',
          background: 'var(--gradient-brand)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textAlign: 'center'
        }}>
          {authView === 'register' ? 'Join Spark Ignite' : 
           authView === 'login' ? 'Welcome Back' : 'Reset Password'}
        </h2>
        <p style={{
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
          {authView === 'register' ? 'Create an account to save your fitness blueprints.' : 
           authView === 'login' ? 'Sign in to access your saved plans and coach.' : 
           'Enter your email to verify your secret recovery question.'}
        </p>

        {error && (
          <div style={{
            background: 'rgba(255, 0, 127, 0.1)',
            border: '1px solid var(--color-accent)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            color: 'var(--color-accent)',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            fontWeight: 500
          }}>
            {error}
          </div>
        )}

        {successMessage && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid #10b981',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            color: '#10b981',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            fontWeight: 500
          }}>
            {successMessage}
          </div>
        )}

        {/* --- View Forms --- */}
        {authView !== 'forgot' ? (
          <form onSubmit={handleAuthSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="form-input"
                required
              />
            </div>

            <div className="form-group" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Password</label>
                {authView === 'login' && (
                  <span 
                    onClick={() => { setAuthView('forgot'); setForgotStep(1); setError(''); setSuccessMessage(''); }}
                    style={{ fontSize: '0.8rem', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Forgot Password?
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input"
                  required
                  style={{ paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {authView === 'register' && (
              <>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="form-input"
                      required
                      style={{ paddingRight: '2.75rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}
                    >
                      {showConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                
                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1.5rem 0' }} />
                
                <div className="form-group">
                  <label className="form-label">Secret Recovery Question</label>
                  <select 
                    value={recoveryQuestion}
                    onChange={(e) => setRecoveryQuestion(e.target.value)}
                    className="form-input"
                  >
                    {RECOVERY_QUESTIONS.map((q, idx) => (
                      <option key={idx} value={q}>{q}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Recovery Answer</label>
                  <input 
                    type="text" 
                    value={recoveryAnswer}
                    onChange={(e) => setRecoveryAnswer(e.target.value)}
                    placeholder="Case-insensitive answer"
                    className="form-input"
                    required
                  />
                </div>
              </>
            )}

            <div style={{ marginTop: '2rem' }}>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : (authView === 'register' ? 'Sign Up' : 'Sign In')}
              </button>
            </div>
          </form>
        ) : (
          /* --- Forgot Password Single-step Form --- */
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Select Recovery Question</label>
              <select 
                value={recoveryQuestion}
                onChange={(e) => setRecoveryQuestion(e.target.value)}
                className="form-input"
              >
                {RECOVERY_QUESTIONS.map((q, idx) => (
                  <option key={idx} value={q}>{q}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Secret Recovery Answer</label>
              <input 
                type="text" 
                value={recoveryAnswer}
                onChange={(e) => setRecoveryAnswer(e.target.value)}
                placeholder="Enter your recovery answer"
                className="form-input"
                required
              />
            </div>

            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showNewPassword ? "text" : "password"} 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input"
                  required
                  style={{ paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}
                >
                  {showNewPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showNewPassword ? "text" : "password"} 
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input"
                  required
                  style={{ paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}
                >
                  {showNewPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isLoading}>
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}

        {/* Footer Toggle Navigation */}
        <div style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: 'var(--text-muted)'
        }}>
          {authView === 'register' && (
            <>
              Already have an account?{' '}
              <span onClick={() => { setAuthView('login'); setError(''); setSuccessMessage(''); }} style={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
                Sign In
              </span>
            </>
          )}
          {authView === 'login' && (
            <>
              Don't have an account?{' '}
              <span onClick={() => { setAuthView('register'); setError(''); setSuccessMessage(''); }} style={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
                Sign Up
              </span>
            </>
          )}
          {authView === 'forgot' && (
            <span onClick={() => { setAuthView('login'); setError(''); setSuccessMessage(''); setForgotStep(1); }} style={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
              Back to Login
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
