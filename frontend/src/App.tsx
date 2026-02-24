import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { getMe, login, logout, signup, type AuthMeResponse } from './api';

type Mode = 'loading' | 'unauth' | 'auth';

export default function App() {
  const [mode, setMode] = useState<Mode>('loading');
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [error, setError] = useState<string>('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<'login' | 'signup'>('login');

  const title = useMemo(() => {
    if (mode === 'loading') return 'Loading...';
    if (mode === 'auth' && me) return `Welcome, ${me.email}`;
    return 'Personal Asset Management';
  }, [mode, me]);

  useEffect(() => {
    let active = true;
    (async () => {
      const current = await getMe();
      if (!active) return;
      if (current) {
        setMe(current);
        setMode('auth');
      } else {
        setMe(null);
        setMode('unauth');
      }
    })().catch((e: unknown) => {
      if (!active) return;
      setError(e instanceof Error ? e.message : 'Failed to load.');
      setMode('unauth');
    });
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    try {
      const res = tab === 'login'
        ? await login({ email, password })
        : await signup({ email, password });
      setMe(res);
      setMode('auth');
      setPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    }
  }

  async function onLogout() {
    setError('');
    try {
      await logout();
      setMe(null);
      setMode('unauth');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Logout failed.');
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>{title}</h1>
        {mode === 'auth' ? (
          <button type="button" className="btn" onClick={onLogout}>Logout</button>
        ) : null}
      </header>

      {error ? <p className="error" role="alert">{error}</p> : null}

      {mode === 'loading' ? (
        <p>Checking session...</p>
      ) : null}

      {mode === 'unauth' ? (
        <section>
          <div className="tabs" role="tablist" aria-label="Auth">
            <button
              type="button"
              className={tab === 'login' ? 'tab tab-active' : 'tab'}
              onClick={() => setTab('login')}
              role="tab"
              aria-selected={tab === 'login'}
            >
              Login
            </button>
            <button
              type="button"
              className={tab === 'signup' ? 'tab tab-active' : 'tab'}
              onClick={() => setTab('signup')}
              role="tab"
              aria-selected={tab === 'signup'}
            >
              Sign up
            </button>
          </div>

          <form className="card" onSubmit={onSubmit}>
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
            <button className="btn btn-primary" type="submit">
              {tab === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="hint">
            Dev note: run backend + frontend then use the form. The dev server proxies `/api` to the backend.
          </p>
        </section>
      ) : null}

      {mode === 'auth' && me ? (
        <section className="card">
          <h2>Protected Area</h2>
          <p>
            You are signed in as <strong>{me.email}</strong>.
          </p>
          <ul>
            <li>Session cookie: `JSESSIONID`</li>
            <li>CSRF cookie: `XSRF-TOKEN` (sent via `X-XSRF-TOKEN`)</li>
          </ul>
        </section>
      ) : null}
    </main>
  );
}
