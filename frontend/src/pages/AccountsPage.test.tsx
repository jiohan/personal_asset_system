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

    expect(await screen.findByRole('heading', { name: '자산 계좌' })).toBeInTheDocument();
    expect(screen.getByText('Main Checking')).toBeInTheDocument();
    expect(screen.getByText('Wallet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '보관 Main Checking' }));

    await waitFor(() => {
      expect(patchAccount).toHaveBeenCalledWith(1, { isActive: false });
    });
    expect(await screen.findByText('계좌 상태가 업데이트되었습니다.')).toBeInTheDocument();
  });

  it('creates a new account from the quick row form', async () => {
    vi.mocked(listAccounts)
      .mockResolvedValueOnce({ items: [checkingAccount] })
      .mockResolvedValueOnce({ items: [checkingAccount, cashAccount] });
    vi.mocked(createAccount).mockResolvedValue(cashAccount);

    render(<AccountsPage />);

    await screen.findByRole('heading', { name: '자산 계좌' });
    fireEvent.click(screen.getByRole('button', { name: '새 계좌 추가' }));

    fireEvent.change(screen.getByLabelText('계좌명'), { target: { value: 'Wallet' } });
    fireEvent.change(screen.getByLabelText('계좌 유형'), { target: { value: 'CASH' } });
    fireEvent.change(screen.getByLabelText('기초 잔액 (KRW)'), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: '계좌 생성' }));

    await waitFor(() => {
      expect(createAccount).toHaveBeenCalledWith({
        name: 'Wallet',
        type: 'CASH',
        openingBalance: 20000,
        isActive: true
      });
    });
    expect(await screen.findByText('라이브러리에 계좌가 추가되었습니다.')).toBeInTheDocument();
  });
});
