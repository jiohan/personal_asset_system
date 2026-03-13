import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { vi } from 'vitest';

const accountList = { items: [] };
const categoryList = { items: [] };
const summary = {
  from: '2026-03-01',
  to: '2026-03-11',
  totalIncome: 0,
  totalExpense: 0,
  netSaving: 0,
  transferVolume: 0
};
const cashflow = { from: '2026-03-01', to: '2026-03-11', items: [] };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
});

describe('App Integration', () => {
  it('shows auth form when unauthenticated', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/auth/me')) return new Response(null, { status: 401 });
      return new Response(null, { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    expect(await screen.findByRole('tab', { name: 'Login' })).toBeInTheDocument();
  });

  it('logs in and shows dashboard', async () => {
    document.cookie = 'XSRF-TOKEN=abc';
    const email = 'demo@example.com';

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/api/v1/auth/me')) return new Response(null, { status: 401 });
      if (url.includes('/api/v1/auth/login')) {
        if (init?.method !== 'POST') return new Response(null, { status: 400 });
        return new Response(JSON.stringify({ id: 1, email }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.includes('/api/v1/accounts')) return new Response(JSON.stringify(accountList), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/v1/categories')) return new Response(JSON.stringify(categoryList), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/v1/transactions')) return new Response(JSON.stringify({ items: [], page: 0, size: 20, totalElements: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/v1/reports/summary')) return new Response(JSON.stringify(summary), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/v1/reports/cashflow')) return new Response(JSON.stringify(cashflow), { status: 200, headers: { 'Content-Type': 'application/json' } });

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await screen.findByRole('tab', { name: 'Login' });

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: '컨트롤 센터', level: 1 })).toBeInTheDocument();
  });

  it('sends X-XSRF-TOKEN header for logout and redirects to auth', async () => {
    document.cookie = 'XSRF-TOKEN=abc';
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/me')) {
        return new Response(JSON.stringify({ id: 1, email: 'demo@example.com' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.includes('/api/v1/accounts')) return new Response(JSON.stringify(accountList), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/v1/categories')) return new Response(JSON.stringify(categoryList), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/v1/transactions')) return new Response(JSON.stringify({ items: [], page: 0, size: 20, totalElements: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/v1/reports/summary')) return new Response(JSON.stringify(summary), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/v1/reports/cashflow')) return new Response(JSON.stringify(cashflow), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.endsWith('/api/v1/auth/logout')) {
        const headers = new Headers(init?.headers);
        if (headers.get('X-XSRF-TOKEN') !== 'abc') return new Response(null, { status: 403 });
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    expect(await screen.findByRole('heading', { name: '컨트롤 센터', level: 1 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    expect(await screen.findByRole('tab', { name: 'Login' })).toBeInTheDocument();
  });
});
