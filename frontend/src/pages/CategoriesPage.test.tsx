import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CategoriesPage from './CategoriesPage';

vi.mock('../api', () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  patchCategory: vi.fn(),
  isApiError: (err: unknown) => Boolean(err && typeof err === 'object' && 'status' in err)
}));

import { createCategory, listCategories, patchCategory } from '../api';

const foodCategory = {
  id: 1,
  type: 'EXPENSE',
  name: 'Food',
  parentId: null,
  isActive: true,
  orderIndex: 0
} as const;

const salaryCategory = {
  id: 2,
  type: 'INCOME',
  name: 'Salary',
  parentId: null,
  isActive: true,
  orderIndex: 0
} as const;

describe('CategoriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('switches category lanes and creates a new row', async () => {
    const bonusCategory = {
      id: 3,
      type: 'INCOME',
      name: 'Bonus',
      parentId: null,
      isActive: true,
      orderIndex: 1
    } as const;

    vi.mocked(listCategories)
      .mockResolvedValueOnce({ items: [foodCategory, salaryCategory] })
      .mockResolvedValueOnce({ items: [foodCategory, salaryCategory, bonusCategory] });
    vi.mocked(createCategory).mockResolvedValue(bonusCategory);

    render(<CategoriesPage />);

    expect(await screen.findByRole('heading', { name: 'Category Library' })).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.queryByText('Salary')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Income' }));
    expect(await screen.findByText('Salary')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'Bonus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Category' }));

    await waitFor(() => {
      expect(createCategory).toHaveBeenCalledWith({
        name: 'Bonus',
        type: 'INCOME',
        isActive: true
      });
    });
    expect(await screen.findByText('Category row added.')).toBeInTheDocument();
  });

  it('archives a category row from the utility table', async () => {
    vi.mocked(listCategories)
      .mockResolvedValueOnce({ items: [foodCategory, salaryCategory] })
      .mockResolvedValueOnce({ items: [{ ...foodCategory, isActive: false }, salaryCategory] });
    vi.mocked(patchCategory).mockResolvedValue({ ...foodCategory, isActive: false });

    render(<CategoriesPage />);

    await screen.findByRole('heading', { name: 'Category Library' });
    fireEvent.click(screen.getByRole('button', { name: 'Archive Food' }));

    await waitFor(() => {
      expect(patchCategory).toHaveBeenCalledWith(1, { isActive: false });
    });
    expect(await screen.findByText('Category status updated.')).toBeInTheDocument();
  });
});
