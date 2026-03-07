import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
    getTransferReport: vi.fn(async () => ({
      from: '2026-03-01',
      to: '2026-03-07',
      items: [{ fromAccountId: 1, toAccountId: 2, amount: 500 }]
    }))
  };
});

import { getReportSummary, getTransferReport } from '../api';

describe('ReportsPage', () => {
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

    await screen.findByText('Transfers (Grouped by Account Pair)');
    expect(await screen.findByText('1,000 KRW')).toBeInTheDocument();
    expect(await screen.findByText('400 KRW')).toBeInTheDocument();
    expect(await screen.findByText('600 KRW')).toBeInTheDocument();
    expect(await screen.findByText('200 KRW')).toBeInTheDocument();

    expect(await screen.findByText('Checking')).toBeInTheDocument();
    expect(await screen.findByText('Savings')).toBeInTheDocument();
    expect(await screen.findByText('500 KRW')).toBeInTheDocument();
  });
});
