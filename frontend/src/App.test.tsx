import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { vi } from 'vitest';

type TransactionFixture = {
  id: number;
  txDate: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  accountId: number | null;
  categoryId: number | null;
  description: string;
  needsReview: boolean;
  excludeFromReports: boolean;
  sourceType: 'MANUAL' | 'AUTO_IMPORT';
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
};

const accountList = {
  items: [
    { id: 1, name: 'Main', type: 'CHECKING', isActive: true, orderIndex: 1, openingBalance: 1000, currentBalance: 1000 },
    { id: 2, name: 'Old', type: 'SAVINGS', isActive: false, orderIndex: null, openingBalance: 500, currentBalance: 500 }
  ]
};

const categoryList = {
  items: [
    { id: 10, type: 'EXPENSE', name: 'Food', parentId: null, isActive: true, orderIndex: 1 },
    { id: 11, type: 'INCOME', name: 'Salary', parentId: null, isActive: true, orderIndex: 2 }
  ]
};

function txFixture(overrides: Partial<TransactionFixture> = {}): TransactionFixture {
  return {
    id: 1,
    txDate: '2026-03-01',
    type: 'EXPENSE',
    amount: 1200,
    accountId: 1,
    categoryId: 10,
    description: 'Lunch',
    needsReview: false,
    excludeFromReports: false,
    sourceType: 'MANUAL',
    sourceId: null,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    ...overrides
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
});

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
    document.cookie = 'XSRF-TOKEN=abc';
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
      if (url === '/api/v1/accounts') {
        return new Response(JSON.stringify(accountList), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/v1/categories') {
        return new Response(JSON.stringify(categoryList), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.startsWith('/api/v1/transactions')) {
        return new Response(JSON.stringify({ items: [], page: 0, size: 20, totalElements: 0 }), {
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
      if (url === '/api/v1/accounts') return new Response(JSON.stringify(accountList), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url === '/api/v1/categories') return new Response(JSON.stringify(categoryList), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.startsWith('/api/v1/transactions')) return new Response(JSON.stringify({ items: [], page: 0, size: 20, totalElements: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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

  it('hides inactive accounts by default and reveals them on toggle', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/v1/auth/me') {
        return new Response(JSON.stringify({ id: 1, email: 'demo@example.com' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/v1/accounts') return new Response(JSON.stringify(accountList), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url === '/api/v1/categories') return new Response(JSON.stringify(categoryList), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.startsWith('/api/v1/transactions')) return new Response(JSON.stringify({ items: [], page: 0, size: 20, totalElements: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    expect(await screen.findByText('Protected Area')).toBeInTheDocument();
    expect(screen.getAllByText('Main').length).toBeGreaterThan(0);
    expect(screen.queryByText('Old', { selector: 'strong' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Show inactive'));
    expect(await screen.findByText('Old', { selector: 'strong' })).toBeInTheDocument();
  });

  it('creates, updates, and deletes a transaction', async () => {
    document.cookie = 'XSRF-TOKEN=abc';
    let transactions: TransactionFixture[] = [txFixture()];
    let createdPayload: Record<string, unknown> | null = null;
    let patchedPayload: Record<string, unknown> | null = null;
    let deletedId: number | null = null;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = String(input);
      const url = new URL(raw, 'http://localhost');
      const { pathname, searchParams } = url;

      if (pathname === '/api/v1/auth/me') return new Response(JSON.stringify({ id: 1, email: 'demo@example.com' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (pathname === '/api/v1/accounts') return new Response(JSON.stringify(accountList), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (pathname === '/api/v1/categories') return new Response(JSON.stringify(categoryList), { status: 200, headers: { 'Content-Type': 'application/json' } });

      if (pathname === '/api/v1/transactions' && (!init?.method || init.method === 'GET')) {
        const page = Number(searchParams.get('page') ?? '0');
        return new Response(JSON.stringify({ items: transactions, page, size: 20, totalElements: transactions.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (pathname === '/api/v1/transactions' && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        createdPayload = payload;
        transactions = [
          ...transactions,
          txFixture({ id: 2, amount: Number(payload.amount), description: String(payload.description ?? ''), categoryId: (payload.categoryId as number | null) ?? null })
        ];
        return new Response(JSON.stringify(transactions[transactions.length - 1]), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }

      if (pathname === '/api/v1/transactions/1' && init?.method === 'PATCH') {
        patchedPayload = JSON.parse(String(init.body));
        transactions = transactions.map((t) => (t.id === 1
          ? { ...t, amount: Number(patchedPayload?.amount), description: String(patchedPayload?.description ?? t.description) }
          : t));
        return new Response(JSON.stringify(transactions.find((t) => t.id === 1)), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (pathname === '/api/v1/transactions/1' && init?.method === 'DELETE') {
        deletedId = 1;
        transactions = transactions.filter((t) => t.id !== 1);
        return new Response(null, { status: 204 });
      }

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    expect(await screen.findByText('Protected Area')).toBeInTheDocument();
    expect(await screen.findByText(/Lunch/)).toBeInTheDocument();

    const createForm = screen.getByRole('button', { name: 'Add transaction' }).closest('form');
    if (!createForm) throw new Error('Create transaction form not found.');
    const createFormQueries = within(createForm);

    fireEvent.change(createFormQueries.getByLabelText('Amount (KRW)'), { target: { value: '2400' } });
    fireEvent.change(createFormQueries.getByLabelText('Account'), { target: { value: '1' } });
    fireEvent.change(createFormQueries.getByLabelText('Category (optional)'), { target: { value: '10' } });
    fireEvent.change(createFormQueries.getByLabelText('Description'), { target: { value: 'Dinner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));

    await screen.findByText(/Dinner/);
    expect(createdPayload).toMatchObject({ amount: 2400, accountId: 1, categoryId: 10, description: 'Dinner' });

    const lunchRow = screen.getByText(/Lunch/).closest('li');
    if (!lunchRow) throw new Error('Lunch transaction row not found.');
    fireEvent.click(within(lunchRow).getByRole('button', { name: 'Edit' }));
    const editForm = screen.getByRole('button', { name: 'Save' }).closest('form');
    if (!editForm) throw new Error('Edit transaction form not found.');
    const editFormQueries = within(editForm);

    fireEvent.change(editFormQueries.getByLabelText('Amount'), { target: { value: '1500' } });
    fireEvent.change(editFormQueries.getByLabelText('Description'), { target: { value: 'Lunch-updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText(/Lunch-updated/);
    expect(patchedPayload).toMatchObject({ amount: 1500, description: 'Lunch-updated' });

    const updatedRow = screen.getByText(/Lunch-updated/).closest('li');
    if (!updatedRow) throw new Error('Updated transaction row not found.');
    fireEvent.click(within(updatedRow).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText(/Lunch-updated/)).not.toBeInTheDocument());
    expect(deletedId).toBe(1);
  });

  it('applies transaction filters with expected query parameters', async () => {
    document.cookie = 'XSRF-TOKEN=abc';
    const requestedQueries: string[] = [];

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const raw = String(input);
      const url = new URL(raw, 'http://localhost');

      if (url.pathname === '/api/v1/auth/me') return new Response(JSON.stringify({ id: 1, email: 'demo@example.com' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.pathname === '/api/v1/accounts') return new Response(JSON.stringify(accountList), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.pathname === '/api/v1/categories') return new Response(JSON.stringify(categoryList), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.pathname === '/api/v1/transactions') {
        requestedQueries.push(url.search);
        return new Response(JSON.stringify({ items: [txFixture()], page: 0, size: 20, totalElements: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    expect(await screen.findByText('Protected Area')).toBeInTheDocument();

    const filterForm = screen.getByRole('heading', { name: 'Filters' }).closest('form');
    if (!filterForm) throw new Error('Filter form not found.');
    const filterFormQueries = within(filterForm);

    fireEvent.change(filterFormQueries.getByLabelText('Type'), { target: { value: 'EXPENSE' } });
    fireEvent.change(filterFormQueries.getByLabelText('Search'), { target: { value: 'lunch' } });
    fireEvent.change(filterFormQueries.getByLabelText('From date'), { target: { value: '2026-03-01' } });
    fireEvent.change(filterFormQueries.getByLabelText('To date'), { target: { value: '2026-03-31' } });
    fireEvent.change(filterFormQueries.getByLabelText('Account'), { target: { value: '1' } });
    fireEvent.change(filterFormQueries.getByLabelText('Category'), { target: { value: '10' } });
    fireEvent.change(filterFormQueries.getByLabelText('Sort'), { target: { value: 'amount,asc' } });
    fireEvent.click(filterFormQueries.getByLabelText('needsReview only'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    const lastQuery = requestedQueries[requestedQueries.length - 1];
    expect(lastQuery).toContain('type=EXPENSE');
    expect(lastQuery).toContain('q=lunch');
    expect(lastQuery).toContain('from=2026-03-01');
    expect(lastQuery).toContain('to=2026-03-31');
    expect(lastQuery).toContain('accountId=1');
    expect(lastQuery).toContain('categoryId=10');
    expect(lastQuery).toContain('needsReview=true');
    expect(lastQuery).toContain('sort=amount%2Casc');
  });

  it('navigates transaction pagination with next and prev', async () => {
    document.cookie = 'XSRF-TOKEN=abc';
    const requestedPages: number[] = [];

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const raw = String(input);
      const url = new URL(raw, 'http://localhost');

      if (url.pathname === '/api/v1/auth/me') return new Response(JSON.stringify({ id: 1, email: 'demo@example.com' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.pathname === '/api/v1/accounts') return new Response(JSON.stringify(accountList), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.pathname === '/api/v1/categories') return new Response(JSON.stringify(categoryList), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.pathname === '/api/v1/transactions') {
        const page = Number(url.searchParams.get('page') ?? '0');
        requestedPages.push(page);
        const item = page === 0 ? txFixture({ id: 1, description: 'page-0' }) : txFixture({ id: 2, description: 'page-1' });
        return new Response(JSON.stringify({ items: [item], page, size: 20, totalElements: 40 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    expect(await screen.findByText(/page-0/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText(/page-1/)).toBeInTheDocument();
    expect(screen.getByText('Page 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Prev' }));
    expect(await screen.findByText(/page-0/)).toBeInTheDocument();
    expect(requestedPages).toEqual(expect.arrayContaining([0, 1]));
  });
});
