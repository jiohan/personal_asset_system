import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccountsPage from './AccountsPage';

vi.mock('../api', () => ({
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  patchAccount: vi.fn(),
  isApiError: (err: unknown) => Boolean(err && typeof err === 'object' && 'status' in err)
}));

import { createAccount, listAccounts, patchAccount } from '../api';

const checkingAccount = {
  id: 1,
  name: 'Main Checking',
  type: 'CHECKING',
  isActive: true,
  orderIndex: 0,
  openingBalance: 100000,
  currentBalance: 125000
} as const;

const cashAccount = {
  id: 2,
  name: 'Wallet',
  type: 'CASH',
  isActive: true,
  orderIndex: 1,
  openingBalance: 20000,
  currentBalance: 18000
} as const;

describe('AccountsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dense account table and archives a row', async () => {
    vi.mocked(listAccounts)
      .mockResolvedValueOnce({ items: [checkingAccount, cashAccount] })
      .mockResolvedValueOnce({ items: [{ ...checkingAccount, isActive: false }, cashAccount] });
    vi.mocked(patchAccount).mockResolvedValue({ ...checkingAccount, isActive: false });

    render(<AccountsPage />);

    expect(await screen.findByRole('heading', { name: 'Ledger Accounts' })).toBeInTheDocument();
    expect(screen.getByText('Main Checking')).toBeInTheDocument();
    expect(screen.getByText('Wallet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Archive Main Checking' }));

    await waitFor(() => {
      expect(patchAccount).toHaveBeenCalledWith(1, { isActive: false });
    });
    expect(await screen.findByText('Account status updated.')).toBeInTheDocument();
  });

  it('creates a new account from the quick row form', async () => {
    vi.mocked(listAccounts)
      .mockResolvedValueOnce({ items: [checkingAccount] })
      .mockResolvedValueOnce({ items: [checkingAccount, cashAccount] });
    vi.mocked(createAccount).mockResolvedValue(cashAccount);

    render(<AccountsPage />);

    await screen.findByRole('heading', { name: 'Ledger Accounts' });
    fireEvent.click(screen.getByRole('button', { name: 'New Row' }));

    fireEvent.change(screen.getByLabelText('Account name'), { target: { value: 'Wallet' } });
    fireEvent.change(screen.getByLabelText('Account type'), { target: { value: 'CASH' } });
    fireEvent.change(screen.getByLabelText('Opening balance (KRW)'), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(createAccount).toHaveBeenCalledWith({
        name: 'Wallet',
        type: 'CASH',
        openingBalance: 20000,
        isActive: true
      });
    });
    expect(await screen.findByText('Account row added to the library.')).toBeInTheDocument();
  });
});
