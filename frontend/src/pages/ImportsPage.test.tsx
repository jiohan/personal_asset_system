import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImportsPage from './ImportsPage';

vi.mock('../api', () => {
  return {
    listAccounts: vi.fn(async () => ({
      items: [
        { id: 1, name: 'Main Checking', type: 'CHECKING', isActive: true, orderIndex: null, openingBalance: 0, currentBalance: 0 }
      ]
    })),
    importTransactionsCsv: vi.fn(async () => ({
      createdCount: 2,
      skippedCount: 1,
      warningCount: 0,
      errorCount: 0,
      warnings: []
    })),
    isApiError: (err: unknown) => Boolean(err && typeof err === 'object' && 'status' in err)
  };
});

import { importTransactionsCsv, listAccounts } from '../api';

describe('ImportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses csv headers, auto-maps account names, and submits import', async () => {
    render(<ImportsPage />);

    await waitFor(() => expect(listAccounts).toHaveBeenCalled());

    const file = new File(
      ['Date,Amount,Description,Account,Type\n2026-03-01,12500,Coffee,Main Checking,EXPENSE'],
      'sample.csv',
      { type: 'text/csv' }
    );
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue('Date,Amount,Description,Account,Type\n2026-03-01,12500,Coffee,Main Checking,EXPENSE')
    });

    fireEvent.change(screen.getByLabelText('CSV File'), {
      target: { files: [file] }
    });

    expect(await screen.findByText('Detected Headers')).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Main Checking' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'RUN IMPORT' }));

    await waitFor(() => {
      expect(importTransactionsCsv).toHaveBeenCalledTimes(1);
    });

    expect(importTransactionsCsv).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        columns: expect.objectContaining({
          txDate: 'Date',
          amount: 'Amount',
          description: 'Description',
          account: 'Account',
          type: 'Type'
        }),
        accountNameMap: { 'Main Checking': 1 },
        defaultType: 'EXPENSE'
      })
    );

    const resultCard = (await screen.findByText('Import Result')).closest('.import-result-card');
    expect(resultCard).not.toBeNull();
    expect(within(resultCard as HTMLElement).getByText('2')).toBeInTheDocument();
    expect(within(resultCard as HTMLElement).getByText('1')).toBeInTheDocument();
  });
});
