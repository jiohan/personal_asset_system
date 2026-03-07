import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { login, signup } from '../api';
import { Navigate, useNavigate } from 'react-router-dom';

export default function AuthPage() {
    const { me, setMe } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (me) {
        return <Navigate to="/dashboard" replace />;
    }

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const res = tab === 'login' ? await login({ email, password }) : await signup({ email, password });
            setMe(res);
            navigate('/dashboard', { replace: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Request failed.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="auth-shell">
            <div className="auth-card">
                <h1 className="auth-title">ASSET SYSTEM</h1>

                {error ? <p className="error" role="alert">{error}</p> : null}

                <div className="tabs" role="tablist" aria-label="Auth">
                    <button
                        type="button"
                        className={tab === 'login' ? 'tab tab-active' : 'tab'}
                        onClick={() => { setTab('login'); setError(''); }}
                        role="tab"
                        aria-selected={tab === 'login'}
                    >
                        Login
                    </button>
                    <button
                        type="button"
                        className={tab === 'signup' ? 'tab tab-active' : 'tab'}
                        onClick={() => { setTab('signup'); setError(''); }}
                        role="tab"
                        aria-selected={tab === 'signup'}
                    >
                        Sign up
                    </button>
                </div>

                <form onSubmit={onSubmit}>
                    <label className="field">
                        <span>Email</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </label>
                    <label className="field">
                        <span>Password</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                            minLength={tab === 'signup' ? 8 : 1}
                        />
                    </label>
                    <button className="btn btn-primary" type="submit" disabled={submitting}>
                        {submitting ? 'Working...' : (tab === 'login' ? 'Sign in' : 'Create account')}
                    </button>
                </form>
                <p className="hint" style={{ marginTop: '1rem', textAlign: 'center' }}>
                    Test accounts can be created instantly.
                </p>
            </div>
        </main>
    );
}
