import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { vi } from 'vitest';

describe('App', () => {
  it('shows auth form when unauthenticated', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/v1/auth/me') return new Response(null, { status: 401 });
      return new Response(null, { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    expect(await screen.findByRole('tab', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('logs in and shows protected area', async () => {
    const email = 'demo@example.com';
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/v1/auth/me') return new Response(null, { status: 401 });
      if (url === '/api/v1/auth/login') {
        if (init?.method !== 'POST') return new Response(null, { status: 400 });
        return new Response(JSON.stringify({ id: 1, email }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await screen.findByRole('tab', { name: 'Login' });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Protected Area')).toBeInTheDocument();
    expect(screen.getByText(email)).toBeInTheDocument();
  });

  it('sends X-XSRF-TOKEN header for logout', async () => {
    document.cookie = 'XSRF-TOKEN=abc';

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/v1/auth/me') {
        return new Response(JSON.stringify({ id: 1, email: 'demo@example.com' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/v1/auth/logout') {
        const headers = new Headers(init?.headers);
        if (headers.get('X-XSRF-TOKEN') !== 'abc') return new Response(null, { status: 403 });
        return new Response(null, { status: 204 });
      }

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    expect(await screen.findByText('Protected Area')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    expect(await screen.findByRole('tab', { name: 'Login' })).toBeInTheDocument();
  });
});
