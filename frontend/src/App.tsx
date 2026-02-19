import { useState } from 'react';

type AuthUser = {
  id: number;
  email: string;
};

const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL ?? 'demo@local.dev';
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD ?? 'demo12345';

export default function App() {
  const [statusText, setStatusText] = useState('Waiting for auth check');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  async function runWalkingSkeleton() {
    setStatusText('Logging in with demo user...');

    const loginResponse = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD
      })
    });

    if (!loginResponse.ok) {
      setCurrentUser(null);
      setStatusText(`Login failed: ${loginResponse.status}`);
      return;
    }

    setStatusText('Loading /auth/me...');

    const meResponse = await fetch('/api/v1/auth/me', {
      credentials: 'include'
    });

    if (!meResponse.ok) {
      setCurrentUser(null);
      setStatusText(`Auth boundary failed: ${meResponse.status}`);
      return;
    }

    const me = (await meResponse.json()) as AuthUser;
    setCurrentUser(me);
    setStatusText('Walking skeleton success');
  }

  return (
    <main className="app-shell">
      <h1>Personal Asset Management</h1>
      <p>MVP bootstrap is ready.</p>
      <ul>
        <li>Auth + User Scope</li>
        <li>Accounts / Transactions / Reports</li>
        <li>CSV Import + Backup</li>
      </ul>

      <button onClick={runWalkingSkeleton} type="button">
        Run Walking Skeleton
      </button>

      <p data-testid="status-text">{statusText}</p>
      {currentUser && (
        <p data-testid="current-user">
          Logged in as {currentUser.email} (id: {currentUser.id})
        </p>
      )}
    </main>
  );
}
