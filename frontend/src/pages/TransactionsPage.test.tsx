import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import TransactionsPage from './TransactionsPage';

vi.mock('../api', () => {
  return {
    listTransactions: vi.fn(async () => ({ items: [], page: 0, size: 50, totalElements: 0 })),
    listAccounts: vi.fn(async () => ({ items: [{ id: 1, name: 'Main', type: 'CHECKING', isActive: true, orderIndex: null, openingBalance: 0, currentBalance: 0 }] })),
    listCategories: vi.fn(async () => ({ items: [{ id: 10, type: 'EXPENSE', name: 'Food', parentId: null, isActive: true, orderIndex: null }] })),
     createCategory: vi.fn(async () => ({ id: 11, type: 'EXPENSE', name: 'Taxi', parentId: null, isActive: true, orderIndex: null })),
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
    deleteTransaction: vi.fn(async () => undefined)
  };
});

import { createCategory, listCategories, listTransactions, patchTransaction } from '../api';

function renderAt(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TransactionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses inbox preset when tab=inbox', async () => {
    renderAt('/transactions?tab=inbox');

    await waitFor(() => expect(listTransactions).toHaveBeenCalled());
    const args = (listTransactions as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args.needsReview).toBe(true);
  });

  it('includes categoryId in PATCH when editing', async () => {
    (listTransactions as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: [{
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
      }],
      page: 0,
      size: 50,
      totalElements: 1
    });

    renderAt('/transactions?tab=inbox');

    const row = await screen.findByText('Lunch');
    fireEvent.click(row);

    const categorySelect = screen.getByLabelText('Category') as HTMLSelectElement;
    fireEvent.change(categorySelect, { target: { value: '10' } });

    const needsReview = screen.getByLabelText('Needs Review') as HTMLInputElement;
    expect(needsReview.disabled).toBe(false);
    fireEvent.click(needsReview);
    expect(needsReview.checked).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'COMMIT ENTRY' }));

    await waitFor(() => expect(patchTransaction).toHaveBeenCalled());
    const [, payload] = (patchTransaction as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(payload.categoryId).toBe(10);
  });

  it('sends clearCategory when editing and clearing category', async () => {
    (listTransactions as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
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
        needsReview: false,
        excludeFromReports: false,
        source: 'MANUAL',
        deletedAt: null
      }],
      page: 0,
      size: 50,
      totalElements: 1
    });

    renderAt('/transactions');

    const row = await screen.findByText('Lunch');
    fireEvent.click(row);

    const categorySelect = screen.getByLabelText('Category') as HTMLSelectElement;
    fireEvent.change(categorySelect, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'COMMIT ENTRY' }));

    await waitFor(() => expect(patchTransaction).toHaveBeenCalled());
    const [, payload] = (patchTransaction as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(payload.clearCategory).toBe(true);
  });

  it('creates a new category inline and selects it', async () => {
    (listCategories as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        items: [{ id: 10, type: 'EXPENSE', name: 'Food', parentId: null, isActive: true, orderIndex: null }]
      })
      .mockResolvedValueOnce({
        items: [
          { id: 10, type: 'EXPENSE', name: 'Food', parentId: null, isActive: true, orderIndex: null },
          { id: 11, type: 'EXPENSE', name: 'Taxi', parentId: null, isActive: true, orderIndex: null }
        ]
      });

    (createCategory as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 11,
      type: 'EXPENSE',
      name: 'Taxi',
      parentId: null,
      isActive: true,
      orderIndex: null
    });

    renderAt('/transactions');

    fireEvent.click(screen.getByRole('button', { name: /new transaction/i }));
    await screen.findByText('ADD NEW TRANSACTION');

    fireEvent.click(screen.getByRole('button', { name: /add new category/i }));

    const input = screen.getByLabelText('New category name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Taxi' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(createCategory).toHaveBeenCalled());
    expect(createCategory).toHaveBeenCalledWith({ name: 'Taxi', type: 'EXPENSE', isActive: true });

    await waitFor(() => expect(listCategories).toHaveBeenCalledTimes(2));

    const categorySelect = screen.getByLabelText('Category') as HTMLSelectElement;
    await waitFor(() => expect(categorySelect.value).toBe('11'));
  });
});
