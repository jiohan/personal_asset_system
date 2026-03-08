import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../context/AuthContext', () => {
  return {
    useAuth: () => ({
      me: { id: 7, email: 'demo@example.com' },
      loading: false,
      setMe: vi.fn(),
      checkSession: vi.fn()
    })
  };
});

vi.mock('../components/SummaryCards', () => {
  return {
    default: ({ from, to }: { from: string; to: string }) => (
      <div data-testid="summary-cards">Summary {from} ~ {to}</div>
    )
  };
});

vi.mock('../api', () => {
  return {
    listTransactions: vi.fn(async () => ({ items: [], page: 0, size: 50, totalElements: 0 })),
    listAccounts: vi.fn(async () => ({ items: [
      { id: 1, name: 'Main', type: 'CHECKING', isActive: true, orderIndex: null, openingBalance: 0, currentBalance: 0 },
      { id: 2, name: 'Savings', type: 'SAVINGS', isActive: true, orderIndex: null, openingBalance: 0, currentBalance: 0 }
    ] })),
    listCategories: vi.fn(async () => ({ items: [
      { id: 10, type: 'EXPENSE', name: 'Food', parentId: null, isActive: true, orderIndex: null },
      { id: 11, type: 'EXPENSE', name: 'Taxi', parentId: null, isActive: true, orderIndex: null },
      { id: 12, type: 'EXPENSE', name: 'Travel', parentId: null, isActive: true, orderIndex: null }
    ] })),
    createCategory: vi.fn(async () => ({ id: 13, type: 'EXPENSE', name: 'Groceries', parentId: null, isActive: true, orderIndex: null })),
    createTransaction: vi.fn(async () => ({
      id: 99,
      txDate: '2026-03-07',
      type: 'EXPENSE',
      amount: 1,
      accountId: 1,
      fromAccountId: null,
      toAccountId: null,
      description: '',
      categoryId: null,
      tagNames: [],
      needsReview: true,
      excludeFromReports: false,
      source: 'MANUAL',
      deletedAt: null
    })),
    patchTransaction: vi.fn(async () => ({
      id: 1,
      txDate: '2026-03-07',
      type: 'EXPENSE',
      amount: 12000,
      accountId: 1,
      fromAccountId: null,
      toAccountId: null,
      description: 'Lunch',
      categoryId: 10,
      tagNames: [],
      needsReview: false,
      excludeFromReports: false,
      source: 'MANUAL',
      deletedAt: null
    })),
    deleteTransaction: vi.fn(async () => undefined),
    isApiError: (err: unknown) => {
      return Boolean(err && typeof err === 'object' && 'status' in err);
    }
  };
});

import TransactionsPage from './TransactionsPage';
import {
  createCategory,
  deleteTransaction,
  listCategories,
  listTransactions,
  patchTransaction
} from '../api';

function renderAt(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('TransactionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useRealTimers();

    (listTransactions as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      items: [],
      page: 0,
      size: 50,
      totalElements: 0
    }));

    (listCategories as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      items: [
        { id: 10, type: 'EXPENSE', name: 'Food', parentId: null, isActive: true, orderIndex: null },
        { id: 11, type: 'EXPENSE', name: 'Taxi', parentId: null, isActive: true, orderIndex: null },
        { id: 12, type: 'EXPENSE', name: 'Travel', parentId: null, isActive: true, orderIndex: null }
      ]
    }));
  });

  it('renders summary cards and uses inbox preset query when tab=inbox', async () => {
    renderAt('/transactions?tab=inbox');

    await waitFor(() => expect(listTransactions).toHaveBeenCalled());
    const calls = (listTransactions as unknown as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0]);

    expect(calls.some((args) => args.needsReview === true && args.size === 50)).toBe(true);
    expect(screen.getByTestId('summary-cards')).toBeInTheDocument();
  });

  it('shows Recent/Frequent sections and deduplicates category options', async () => {
    (listCategories as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: [
        { id: 10, type: 'EXPENSE', name: 'Food', parentId: null, isActive: true, orderIndex: null },
        { id: 11, type: 'EXPENSE', name: 'Taxi', parentId: null, isActive: true, orderIndex: null },
        { id: 12, type: 'EXPENSE', name: 'Travel', parentId: null, isActive: true, orderIndex: null },
        { id: 13, type: 'EXPENSE', name: 'Coffee', parentId: null, isActive: true, orderIndex: null },
        { id: 14, type: 'EXPENSE', name: 'Dining', parentId: null, isActive: true, orderIndex: null },
        { id: 15, type: 'EXPENSE', name: 'Taxi Night', parentId: null, isActive: true, orderIndex: null }
      ]
    });

    localStorage.setItem(
      'ams.categoryUsage.v1.user.7.type.EXPENSE',
      JSON.stringify([
        { categoryId: 10, lastUsedAt: '2026-03-08T10:00:00.000Z', useCount: 3 },
        { categoryId: 11, lastUsedAt: '2026-03-07T10:00:00.000Z', useCount: 8 },
        { categoryId: 12, lastUsedAt: '2026-03-06T10:00:00.000Z', useCount: 2 },
        { categoryId: 13, lastUsedAt: '2026-03-05T10:00:00.000Z', useCount: 4 },
        { categoryId: 14, lastUsedAt: '2026-03-04T10:00:00.000Z', useCount: 5 },
        { categoryId: 15, lastUsedAt: '2026-03-03T10:00:00.000Z', useCount: 12 }
      ])
    );

    renderAt('/transactions');

    fireEvent.click(screen.getByRole('button', { name: /new transaction/i }));
    await screen.findByText('ADD NEW TRANSACTION');

    fireEvent.focus(screen.getByLabelText('Category'));

    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('Frequent')).toBeInTheDocument();

    const taxiOptions = screen.getAllByText('Taxi');
    expect(taxiOptions.length).toBe(1);
  });

  it('shows create option only when exact match is missing', async () => {
    renderAt('/transactions');

    fireEvent.click(screen.getByRole('button', { name: /new transaction/i }));
    await screen.findByText('ADD NEW TRANSACTION');

    const categoryInput = screen.getByLabelText('Category') as HTMLInputElement;

    fireEvent.change(categoryInput, { target: { value: 'Taxi' } });
    expect(screen.queryByText('+ Create "Taxi"')).not.toBeInTheDocument();

    fireEvent.change(categoryInput, { target: { value: 'Groceries' } });
    expect(screen.getByText('+ Create "Groceries"')).toBeInTheDocument();
  });

  it('forces Needs Review when category is empty', async () => {
    renderAt('/transactions');

    fireEvent.click(screen.getByRole('button', { name: /new transaction/i }));
    await screen.findByText('ADD NEW TRANSACTION');

    fireEvent.click(screen.getByRole('button', { name: /more options/i }));

    const needsReview = screen.getByLabelText('Needs Review') as HTMLInputElement;
    expect(needsReview.disabled).toBe(true);
    expect(needsReview.checked).toBe(true);
  });

  it('supports delete undo before timeout', async () => {
    (listTransactions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [{
        id: 1,
        txDate: '2026-03-07',
        type: 'EXPENSE',
        amount: 12000,
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
        description: 'Lunch',
        categoryId: 10,
        tagNames: [],
        needsReview: true,
        excludeFromReports: false,
        source: 'MANUAL',
        deletedAt: null
      }],
      page: 0,
      size: 50,
      totalElements: 1
    });

    renderAt('/transactions');

    fireEvent.click(await screen.findByText('Lunch'));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'DELETE' }));

    expect(screen.getByText(/Deleted · Undo/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(deleteTransaction).not.toHaveBeenCalled();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
  });

  it('commits pending delete after 5 seconds', async () => {
    (listTransactions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [{
        id: 1,
        txDate: '2026-03-07',
        type: 'EXPENSE',
        amount: 12000,
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
        description: 'Lunch',
        categoryId: 10,
        tagNames: [],
        needsReview: true,
        excludeFromReports: false,
        source: 'MANUAL',
        deletedAt: null
      }],
      page: 0,
      size: 50,
      totalElements: 1
    });

    renderAt('/transactions');

    fireEvent.click(await screen.findByText('Lunch'));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'DELETE' }));

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flushMicrotasks();
    });

    expect(deleteTransaction).toHaveBeenCalledWith(1);
  });

  it('restores row and shows error when delayed delete fails', async () => {
    (deleteTransaction as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Delete failed.'));

    (listTransactions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [{
        id: 1,
        txDate: '2026-03-07',
        type: 'EXPENSE',
        amount: 12000,
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
        description: 'Lunch',
        categoryId: 10,
        tagNames: [],
        needsReview: true,
        excludeFromReports: false,
        source: 'MANUAL',
        deletedAt: null
      }],
      page: 0,
      size: 50,
      totalElements: 1
    });

    renderAt('/transactions');

    fireEvent.click(await screen.findByText('Lunch'));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'DELETE' }));
    expect(screen.queryByText('Lunch')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flushMicrotasks();
    });

    expect(screen.getByText('Delete failed.')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
  });

  it('supports inbox bulk clear with partial failure', async () => {
    (listTransactions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [
        {
          id: 1,
          txDate: '2026-03-07',
          type: 'EXPENSE',
          amount: 12000,
          accountId: 1,
          fromAccountId: null,
          toAccountId: null,
          description: 'Lunch',
          categoryId: null,
          tagNames: [],
          needsReview: true,
          excludeFromReports: false,
          source: 'MANUAL',
          deletedAt: null
        },
        {
          id: 2,
          txDate: '2026-03-06',
          type: 'EXPENSE',
          amount: 8000,
          accountId: 1,
          fromAccountId: null,
          toAccountId: null,
          description: 'Coffee',
          categoryId: null,
          tagNames: [],
          needsReview: true,
          excludeFromReports: false,
          source: 'MANUAL',
          deletedAt: null
        }
      ],
      page: 0,
      size: 50,
      totalElements: 2
    });

    (patchTransaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) => {
      if (id === 2) throw new Error('PATCH failed');
      return {
        id,
        txDate: '2026-03-07',
        type: 'EXPENSE',
        amount: 1000,
        accountId: 1,
        fromAccountId: null,
        toAccountId: null,
        description: '',
        categoryId: null,
        tagNames: [],
        needsReview: false,
        excludeFromReports: false,
        source: 'MANUAL',
        deletedAt: null
      };
    });

    renderAt('/transactions?tab=inbox');

    await screen.findByText('Lunch');

    fireEvent.click(screen.getByLabelText('Select transaction 1'));
    fireEvent.click(screen.getByLabelText('Select transaction 2'));

    fireEvent.click(screen.getByRole('button', { name: /mark as cleared/i }));

    await waitFor(() => expect(patchTransaction).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Failed to clear 1 item(s). Please retry.')).toBeInTheDocument();
    expect(screen.getByText('Cleared 1 item(s).')).toBeInTheDocument();
  });

  it('creates category from combobox create option', async () => {
    renderAt('/transactions');

    fireEvent.click(screen.getByRole('button', { name: /new transaction/i }));
    await screen.findByText('ADD NEW TRANSACTION');

    const categoryInput = screen.getByLabelText('Category') as HTMLInputElement;
    fireEvent.change(categoryInput, { target: { value: 'Groceries' } });

    fireEvent.click(screen.getByText('+ Create "Groceries"'));

    await waitFor(() => expect(createCategory).toHaveBeenCalledWith({ name: 'Groceries', type: 'EXPENSE', isActive: true }));
  });
});
