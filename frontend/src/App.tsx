import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createAccount,
  getMe,
  listAccounts,
  login,
  logout,
  patchAccount,
  signup,
  type AccountResponse,
  type AccountType,
  type AuthMeResponse
} from './api';

type Mode = 'loading' | 'unauth' | 'auth';

export default function App() {
  const [mode, setMode] = useState<Mode>('loading');
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<'login' | 'signup'>('login');

  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<AccountType>('CHECKING');
  const [createOpeningBalance, setCreateOpeningBalance] = useState('0');
  const [createOrderIndex, setCreateOrderIndex] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editOrderIndex, setEditOrderIndex] = useState('');

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

  useEffect(() => {
    if (mode !== 'auth') {
      setAccounts([]);
      return;
    }

    let active = true;
    setAccountsLoading(true);
    listAccounts()
      .then((res) => {
        if (!active) return;
        setAccounts(res.items);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Failed to load accounts.');
      })
      .finally(() => {
        if (!active) return;
        setAccountsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = tab === 'login'
        ? await login({ email, password })
        : await signup({ email, password });
      setMe(res);
      setMode('auth');
      setPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onLogout() {
    setError('');
    setSubmitting(true);
    try {
      await logout();
      setMe(null);
      setMode('unauth');
      setAccounts([]);
      setEditingId(null);
    } catch (err: unknown) {
      // Slice1 hardening: even if logout fails (network), clear local state to avoid a stuck UI.
      setMe(null);
      setMode('unauth');
      setAccounts([]);
      setEditingId(null);
      setError(err instanceof Error ? err.message : 'Logout failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshAccounts() {
    const res = await listAccounts();
    setAccounts(res.items);
  }

  async function onCreateAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const openingBalance = createOpeningBalance.trim() === '' ? 0 : Number(createOpeningBalance);
      const orderIndex = createOrderIndex.trim() === '' ? undefined : Number(createOrderIndex);
      await createAccount({
        name: createName,
        type: createType,
        openingBalance,
        orderIndex,
        isActive: true
      });
      await refreshAccounts();
      setCreateName('');
      setCreateOpeningBalance('0');
      setCreateOrderIndex('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account.');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(account: AccountResponse) {
    setEditingId(account.id);
    setEditName(account.name);
    setEditIsActive(account.isActive);
    setEditOrderIndex(account.orderIndex == null ? '' : String(account.orderIndex));
  }

  async function onSaveEdit(id: number) {
    setError('');
    setSubmitting(true);
    try {
      const orderIndex = editOrderIndex.trim() === '' ? undefined : Number(editOrderIndex);
      await patchAccount(id, {
        name: editName,
        isActive: editIsActive,
        orderIndex
      });
      await refreshAccounts();
      setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update account.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onToggleActive(account: AccountResponse) {
    setError('');
    setSubmitting(true);
    try {
      await patchAccount(account.id, { isActive: !account.isActive });
      await refreshAccounts();
      if (editingId === account.id) {
        setEditingId(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update account.');
    } finally {
      setSubmitting(false);
    }
  }

  const visibleAccounts = useMemo(
    () => (showInactive ? accounts : accounts.filter((a) => a.isActive)),
    [accounts, showInactive]
  );

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>{title}</h1>
        {mode === 'auth' ? (
          <button type="button" className="btn" onClick={onLogout} disabled={submitting}>Logout</button>
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
              {submitting ? 'Working...' : (tab === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>

          <p className="hint">
            Dev note: run backend + frontend then use the form. The dev server proxies `/api` to the backend.
          </p>
        </section>
      ) : null}

      {mode === 'auth' && me ? (
        <section>
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

          <section className="card accounts-card">
            <div className="accounts-header">
              <h2>Accounts</h2>
              <label className="toggle-inline">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Show inactive
              </label>
            </div>

            {accountsLoading ? <p>Loading accounts...</p> : null}

            {!accountsLoading && visibleAccounts.length === 0 ? (
              <p className="hint">No accounts yet. Create your first account below.</p>
            ) : null}

            {!accountsLoading && visibleAccounts.length > 0 ? (
              <ul className="account-list">
                {visibleAccounts.map((account) => (
                  <li key={account.id} className="account-item">
                    <div>
                      <strong>{account.name}</strong>
                      <p className="hint">
                        {account.type} · Opening {account.openingBalance.toLocaleString()} KRW · {' '}
                        {account.isActive ? 'active' : 'inactive'}
                      </p>
                    </div>
                    <div className="account-actions">
                      <button
                        type="button"
                        className="btn"
                        onClick={() => startEdit(account)}
                        disabled={submitting}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => onToggleActive(account)}
                        disabled={submitting}
                      >
                        {account.isActive ? 'Archive' : 'Activate'}
                      </button>
                    </div>

                    {editingId === account.id ? (
                      <form
                        className="edit-grid"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void onSaveEdit(account.id);
                        }}
                      >
                        <label className="field">
                          <span>Edit name</span>
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            maxLength={100}
                            required
                          />
                        </label>
                        <label className="field">
                          <span>Edit order index</span>
                          <input
                            type="number"
                            value={editOrderIndex}
                            onChange={(e) => setEditOrderIndex(e.target.value)}
                          />
                        </label>
                        <label className="toggle-inline">
                          <input
                            type="checkbox"
                            checked={editIsActive}
                            onChange={(e) => setEditIsActive(e.target.checked)}
                          />
                          Active
                        </label>
                        <div className="account-actions">
                          <button className="btn btn-primary" type="submit" disabled={submitting}>
                            Save
                          </button>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => setEditingId(null)}
                            disabled={submitting}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            <form className="card" onSubmit={onCreateAccount}>
              <h3>Create account</h3>
              <label className="field">
                <span>Name</span>
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  maxLength={100}
                  required
                />
              </label>
              <label className="field">
                <span>Type</span>
                <select
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value as AccountType)}
                >
                  <option value="CHECKING">CHECKING</option>
                  <option value="SAVINGS">SAVINGS</option>
                  <option value="CASH">CASH</option>
                  <option value="INVESTMENT">INVESTMENT</option>
                </select>
              </label>
              <label className="field">
                <span>Opening balance (KRW)</span>
                <input
                  type="number"
                  min={0}
                  value={createOpeningBalance}
                  onChange={(e) => setCreateOpeningBalance(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Order index (optional)</span>
                <input
                  type="number"
                  value={createOrderIndex}
                  onChange={(e) => setCreateOrderIndex(e.target.value)}
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Working...' : 'Add account'}
              </button>
            </form>
          </section>
        </section>
      ) : null}
    </main>
  );
}
