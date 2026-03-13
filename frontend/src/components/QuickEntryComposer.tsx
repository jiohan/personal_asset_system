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
    throw new Error('금액은 0보다 큰 정수여야 합니다.');
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
        throw new Error('계좌를 선택해 주세요.');
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
        setError(err instanceof Error ? err.message : '빠른 등록에 실패했습니다.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card quick-entry-card" aria-label={title} style={{ padding: '20px' }}>
      <div className="quick-entry-head">
        <div>
          <p className="page-kicker">빠른 등록</p>
          <h3>{title}</h3>
        </div>
        {onOpenFullForm ? (
          <button className="btn" type="button" onClick={onOpenFullForm}>
            상세 입력 폼 열기
          </button>
        ) : null}
      </div>
      {description ? <p className="hint">{description}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="quick-entry-grid">
        <div className="quick-entry-step">
          <span className="quick-entry-index">1</span>
          <label className="field">
            <span>금액</span>
            <input
              ref={amountRef}
              aria-label="빠른 등록 금액"
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
            <span>거래처 / 메모</span>
            <input
              ref={merchantRef}
              aria-label="빠른 등록 내용"
              placeholder="커피, 점심, 월급..."
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
              onKeyDown={(event) => moveFocusOnEnter(event, () => accountRef.current?.focus())}
            />
          </label>
        </div>
      </div>

      {showDetails ? (
        <div className="quick-entry-details">
          <div className="quick-entry-type-toggle" role="tablist" aria-label="Quick entry type" style={{ marginBottom: '16px', marginTop: '4px' }}>
            <button
              type="button"
              className={`chip ${txType === 'EXPENSE' ? 'active' : ''}`}
              onClick={() => setTxType('EXPENSE')}
            >
              지출
            </button>
            <button
              type="button"
              className={`chip ${txType === 'INCOME' ? 'active' : ''}`}
              onClick={() => setTxType('INCOME')}
            >
              수입
            </button>
          </div>

          <div className="quick-entry-step" style={{ alignItems: 'flex-start' }}>
            <span className="quick-entry-index">3</span>
            <div className="quick-entry-grid" style={{ flex: 1, width: '100%', gap: '12px' }}>
              <label className="field">
                <span>계좌</span>
                <select
                  ref={accountRef}
                  aria-label="빠른 등록 계좌"
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  onKeyDown={(event) => moveFocusOnEnter(event, () => categoryRef.current?.focus())}
                >
                  <option value="">계좌 선택</option>
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.accountId ? <span className="hint error">{fieldErrors.accountId}</span> : null}
              </label>

              <label className="field">
                <span>카테고리</span>
                <select
                  ref={categoryRef}
                  aria-label="빠른 등록 카테고리"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    void handleSubmit();
                  }}
                >
                  <option value="">미지정 (검토 필요)</option>
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
            <div className="chip-group quick-entry-suggestions" style={{ marginTop: '16px', paddingLeft: '32px' }}>
              <span className="chip-group-label">빠른 선택</span>
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

          <div className="quick-entry-actions" style={{ marginTop: '20px' }}>
            <p className="hint">
              <strong>Enter</strong>를 눌러 다음 단계로 이동하세요. 카테고리를 비워두면 검토가 필요한 항목으로 분류됩니다.
            </p>
            <button
              className="btn btn-primary"
              type="button"
              disabled={!canSubmit || saving}
              onClick={() => {
                void handleSubmit();
              }}
            >
              {saving ? '저장 중...' : actionLabel}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
