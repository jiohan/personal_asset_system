import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import ReportsPage from './ReportsPage';

vi.mock('../api', () => {
  return {
    listAccounts: vi.fn(async () => ({
      items: [
        { id: 1, name: 'Checking', type: 'CHECKING', isActive: true, orderIndex: null, openingBalance: 0, currentBalance: 0 },
        { id: 2, name: 'Savings', type: 'SAVINGS', isActive: true, orderIndex: null, openingBalance: 0, currentBalance: 0 }
      ]
    })),
    getReportSummary: vi.fn(async () => ({
      from: '2026-03-01',
      to: '2026-03-07',
      totalIncome: 1000,
      totalExpense: 400,
      netSaving: 600,
      transferVolume: 200
    })),
    getCashflowTrend: vi.fn(async () => ({
      from: '2026-03-01',
      to: '2026-03-07',
      items: [
        { date: '2026-03-01', income: 1000, expense: 0, net: 1000, transfer: 0 },
        { date: '2026-03-02', income: 0, expense: 400, net: -400, transfer: 0 }
      ]
    })),
    getTopExpenseCategories: vi.fn(async () => ({
      from: '2026-03-01',
      to: '2026-03-07',
      limit: 6,
      items: [
        { categoryId: 11, categoryName: 'Food', amount: 300, transactionCount: 2 },
        { categoryId: null, categoryName: 'Uncategorized', amount: 100, transactionCount: 1 }
      ]
    })),
    getAccountBalanceTrend: vi.fn(async () => ({
      from: '2026-03-01',
      to: '2026-03-07',
      items: [
        {
          accountId: 1,
          accountName: 'Checking',
          accountType: 'CHECKING',
          openingBalance: 0,
          currentBalance: 600,
          points: [
            { date: '2026-03-01', balance: 1000 },
            { date: '2026-03-02', balance: 600 }
          ]
        }
      ]
    })),
    getTransferReport: vi.fn(async () => ({
      from: '2026-03-01',
      to: '2026-03-07',
      items: [{ fromAccountId: 1, toAccountId: 2, amount: 500 }]
    }))
  };
});

import {
  getAccountBalanceTrend,
  getCashflowTrend,
  getReportSummary,
  getTopExpenseCategories,
  getTransferReport
} from '../api';

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads summary and transfer report for default date range', async () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const expectedFrom = `${yyyy}-${mm}-01`;
    const expectedTo = `${yyyy}-${mm}-${dd}`;

    render(<ReportsPage />);

    await waitFor(() => expect(getReportSummary).toHaveBeenCalled());
    expect(getReportSummary).toHaveBeenCalledWith({ from: expectedFrom, to: expectedTo });
    expect(getTransferReport).toHaveBeenCalledWith({ from: expectedFrom, to: expectedTo });
    expect(getCashflowTrend).toHaveBeenCalledWith({ from: expectedFrom, to: expectedTo });
    expect(getTopExpenseCategories).toHaveBeenCalledWith({ from: expectedFrom, to: expectedTo, limit: 6 });
    expect(getAccountBalanceTrend).toHaveBeenCalledWith({ from: expectedFrom, to: expectedTo });

    await screen.findByText('Top Categories');
    expect(await screen.findByText('1,000 KRW')).toBeInTheDocument();
    expect(await screen.findByText('400 KRW')).toBeInTheDocument();
    expect(await screen.findByText('600 KRW')).toBeInTheDocument();
    expect(await screen.findByText('200 KRW')).toBeInTheDocument();

    expect((await screen.findAllByText('Checking')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Food')).toBeInTheDocument();
    expect(await screen.findByText('2 item(s)')).toBeInTheDocument();
    expect((await screen.findAllByText('Savings')).length).toBeGreaterThan(0);
    expect(await screen.findByText('500 KRW')).toBeInTheDocument();
  });

  it('applies last month preset and reloads reports', async () => {
    const now = new Date();
    const presetYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const presetMonthIndex = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const expectedFrom = `${presetYear}-${String(presetMonthIndex + 1).padStart(2, '0')}-01`;
    const expectedTo = `${presetYear}-${String(presetMonthIndex + 1).padStart(2, '0')}-${String(new Date(presetYear, presetMonthIndex + 1, 0).getDate()).padStart(2, '0')}`;

    render(<ReportsPage />);

    await waitFor(() => expect(getReportSummary).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Last Month' }));

    await waitFor(() => {
      expect(getReportSummary).toHaveBeenLastCalledWith({ from: expectedFrom, to: expectedTo });
      expect(getTransferReport).toHaveBeenLastCalledWith({ from: expectedFrom, to: expectedTo });
      expect(getCashflowTrend).toHaveBeenLastCalledWith({ from: expectedFrom, to: expectedTo });
      expect(getTopExpenseCategories).toHaveBeenLastCalledWith({ from: expectedFrom, to: expectedTo, limit: 6 });
      expect(getAccountBalanceTrend).toHaveBeenLastCalledWith({ from: expectedFrom, to: expectedTo });
    });
  });
});
