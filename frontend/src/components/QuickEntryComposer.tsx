import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  createTransaction,
  isApiError,
  type AccountResponse,
  type CategoryResponse,
  type TransactionType
} from '../api';

type QuickEntryComposerProps = {
  accounts: AccountResponse[];
  categories: CategoryResponse[];
  title: string;
  description?: string;
  actionLabel?: string;
  onSaved?: () => Promise<void> | void;
  onOpenFullForm?: () => void;
  suggestedCategoryIds?: number[];
  defaultType?: Extract<TransactionType, 'INCOME' | 'EXPENSE'>;
};

function parsePositiveInteger(input: string): number {
  const normalized = input.replace(/[^\d-]/g, '').trim();
  const value = Number(normalized);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error('Amount must be a positive integer.');
  }
  return value;
}

export default function QuickEntryComposer({
  accounts,
  categories,
  title,
  description,
  actionLabel = 'Save Entry',
  onSaved,
  onOpenFullForm,
  suggestedCategoryIds = [],
  defaultType = 'EXPENSE'
}: QuickEntryComposerProps) {
  const activeAccounts = useMemo(() => accounts.filter((account) => account.isActive), [accounts]);
  const [txType, setTxType] = useState<Extract<TransactionType, 'INCOME' | 'EXPENSE'>>(defaultType);
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const amountRef = useRef<HTMLInputElement | null>(null);
  const merchantRef = useRef<HTMLInputElement | null>(null);
  const accountRef = useRef<HTMLSelectElement | null>(null);
  const categoryRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    if (activeAccounts.length === 0) {
      setAccountId('');
      return;
    }
    setAccountId((current) => current || String(activeAccounts[0].id));
  }, [activeAccounts]);

  useEffect(() => {
    setCategoryId('');
  }, [txType]);

  const selectableCategories = useMemo(
    () => categories.filter((category) => category.isActive && category.type === txType),
    [categories, txType]
  );

  const categoryById = useMemo(() => {
    const map = new Map<number, CategoryResponse>();
    for (const category of selectableCategories) {
      map.set(category.id, category);
    }
    return map;
  }, [selectableCategories]);

  const suggestedCategories = useMemo(() => {
    const seen = new Set<number>();
    const result: CategoryResponse[] = [];

    for (const id of suggestedCategoryIds) {
      if (seen.has(id)) continue;
      const category = categoryById.get(id);
      if (!category) continue;
      seen.add(id);
      result.push(category);
      if (result.length >= 5) break;
    }

    if (result.length >= 5) return result;

    for (const category of selectableCategories) {
      if (seen.has(category.id)) continue;
      seen.add(category.id);
      result.push(category);
      if (result.length >= 5) break;
    }

    return result;
  }, [categoryById, selectableCategories, suggestedCategoryIds]);

  const showDetails = amount.trim() !== '' || merchant.trim() !== '';
  const canSubmit = activeAccounts.length > 0 && amount.trim() !== '';

  const reset = () => {
    setAmount('');
    setMerchant('');
    setCategoryId('');
    setFieldErrors({});
    amountRef.current?.focus();
  };

  const moveFocusOnEnter = (event: KeyboardEvent<HTMLElement>, next: () => void) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    next();
  };

  const handleSubmit = async () => {
    setError('');
    setFieldErrors({});
    setSaving(true);

    try {
      const parsedAmount = parsePositiveInteger(amount);
      const parsedAccountId = Number(accountId);
      if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
        throw new Error('Account is required.');
      }

      const parsedCategoryId = categoryId ? Number(categoryId) : null;

      await createTransaction({
        txDate: new Date().toISOString().slice(0, 10),
        type: txType,
        amount: parsedAmount,
        accountId: parsedAccountId,
        categoryId: parsedCategoryId,
        description: merchant.trim(),
        needsReview: parsedCategoryId == null,
        excludeFromReports: false
      });

      reset();
      await onSaved?.();
    } catch (err: unknown) {
      if (isApiError(err) && err.fieldErrors) {
        const next: Record<string, string> = {};
        for (const fieldError of err.fieldErrors) {
          if (!next[fieldError.field]) next[fieldError.field] = fieldError.reason;
        }
        setFieldErrors(next);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Quick entry failed.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card quick-entry-card" aria-label={title}>
      <div className="quick-entry-head">
        <div>
          <p className="page-kicker">Quick Entry</p>
          <h3>{title}</h3>
        </div>
        {onOpenFullForm ? (
          <button className="btn" type="button" onClick={onOpenFullForm}>
            Open Full Form
          </button>
        ) : null}
      </div>
      {description ? <p className="hint">{description}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="quick-entry-grid">
        <div className="quick-entry-step">
          <span className="quick-entry-index">1</span>
          <label className="field">
            <span>Amount</span>
            <input
              ref={amountRef}
              aria-label="Quick Entry Amount"
              inputMode="numeric"
              placeholder="12500"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              onKeyDown={(event) => moveFocusOnEnter(event, () => merchantRef.current?.focus())}
            />
            {fieldErrors.amount ? <span className="hint error">{fieldErrors.amount}</span> : null}
          </label>
        </div>

        <div className="quick-entry-step">
          <span className="quick-entry-index">2</span>
          <label className="field">
            <span>Merchant / Note</span>
            <input
              ref={merchantRef}
              aria-label="Quick Entry Merchant"
              placeholder="Coffee, lunch, payroll..."
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
              onKeyDown={(event) => moveFocusOnEnter(event, () => accountRef.current?.focus())}
            />
          </label>
        </div>
      </div>

      {showDetails ? (
        <div className="quick-entry-details">
          <div className="quick-entry-type-toggle" role="tablist" aria-label="Quick entry type">
            <button
              type="button"
              className={`chip ${txType === 'EXPENSE' ? 'active' : ''}`}
              onClick={() => setTxType('EXPENSE')}
            >
              Expense
            </button>
            <button
              type="button"
              className={`chip ${txType === 'INCOME' ? 'active' : ''}`}
              onClick={() => setTxType('INCOME')}
            >
              Income
            </button>
          </div>

          <div className="quick-entry-grid">
            <div className="quick-entry-step">
              <span className="quick-entry-index">3</span>
              <label className="field">
                <span>Account</span>
                <select
                  ref={accountRef}
                  aria-label="Quick Entry Account"
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  onKeyDown={(event) => moveFocusOnEnter(event, () => categoryRef.current?.focus())}
                >
                  <option value="">Select account</option>
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.accountId ? <span className="hint error">{fieldErrors.accountId}</span> : null}
              </label>
            </div>

            <div className="quick-entry-step">
              <span className="quick-entry-index">4</span>
              <label className="field">
                <span>Category</span>
                <select
                  ref={categoryRef}
                  aria-label="Quick Entry Category"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    void handleSubmit();
                  }}
                >
                  <option value="">Leave uncategorized</option>
                  {selectableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {suggestedCategories.length > 0 ? (
            <div className="chip-group quick-entry-suggestions">
              <span className="chip-group-label">Fast Pick</span>
              {suggestedCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`chip ${categoryId === String(category.id) ? 'active' : ''}`}
                  onClick={() => setCategoryId(String(category.id))}
                >
                  {category.name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="quick-entry-actions">
            <p className="hint">
              Press <strong>Enter</strong> to advance. Leave category empty to send the row to inbox review.
            </p>
            <button
              className="btn btn-primary"
              type="button"
              disabled={!canSubmit || saving}
              onClick={() => {
                void handleSubmit();
              }}
            >
              {saving ? 'Saving...' : actionLabel}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
