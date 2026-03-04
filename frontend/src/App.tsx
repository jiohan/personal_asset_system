import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createAccount,
  createCategory,
  createTransaction,
  deleteTransaction,
  getMe,
  listAccounts,
  listCategories,
  listTransactions,
  login,
  logout,
  patchAccount,
  patchCategory,
  patchTransaction,
  signup,
  type AccountResponse,
  type AccountType,
  type AuthMeResponse,
  type CategoryResponse,
  type TransactionResponse,
  type TransactionType
} from './api';

type Mode = 'loading' | 'unauth' | 'auth';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseOptionalInteger(input: string, fieldName: string): number | undefined {
  const v = input.trim();
  if (v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`${fieldName} must be an integer.`);
  }
  return n;
}

function parseNonNegativeInteger(input: string, fieldName: string): number {
  const v = input.trim();
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }
  return n;
}

function parsePositiveInteger(input: string, fieldName: string): number {
  const v = input.trim();
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return n;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('loading');
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<'login' | 'signup'>('login');

  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<AccountType>('CHECKING');
  const [createOpeningBalance, setCreateOpeningBalance] = useState('0');
  const [createOrderIndex, setCreateOrderIndex] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editOrderIndex, setEditOrderIndex] = useState('');

  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<TransactionType>('EXPENSE');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [txPage, setTxPage] = useState(0);
  const [txSize] = useState(20);
  const [txTotal, setTxTotal] = useState(0);
  const [txLoading, setTxLoading] = useState(false);

  const [filterType, setFilterType] = useState<'' | TransactionType>('');
  const [filterNeedsReview, setFilterNeedsReview] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterSort, setFilterSort] = useState('txDate,desc');

  const [txDate, setTxDate] = useState(todayISO());
  const [txType, setTxType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [txAmount, setTxAmount] = useState('0');
  const [txAccountId, setTxAccountId] = useState('');
  const [txCategoryId, setTxCategoryId] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txNeedsReview, setTxNeedsReview] = useState(false);
  const [txExcludeFromReports, setTxExcludeFromReports] = useState(false);

  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editingTxAmount, setEditingTxAmount] = useState('');
  const [editingTxDescription, setEditingTxDescription] = useState('');
  const [editingTxNeedsReview, setEditingTxNeedsReview] = useState(false);
  const [editingTxExclude, setEditingTxExclude] = useState(false);

  const title = useMemo(() => {
    if (mode === 'loading') return 'Loading...';
    if (mode === 'auth' && me) return `Welcome, ${me.email}`;
    return 'Personal Asset Management';
  }, [mode, me]);

  useEffect(() => {
    let active = true;
    (async () => {
      const current = await getMe();
      if (!active) return;
      if (current) {
        setMe(current);
        setMode('auth');
      } else {
        setMe(null);
        setMode('unauth');
      }
    })().catch((e: unknown) => {
      if (!active) return;
      setError(e instanceof Error ? e.message : 'Failed to load.');
      setMode('unauth');
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'auth') {
      setAccounts([]);
      setCategories([]);
      setTransactions([]);
      return;
    }

    void refreshAccounts();
    void refreshCategories();
    void refreshTransactions(0);
  }, [mode]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = tab === 'login' ? await login({ email, password }) : await signup({ email, password });
      setMe(res);
      setMode('auth');
      setPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onLogout() {
    setError('');
    setSubmitting(true);
    try {
      await logout();
      setMe(null);
      setMode('unauth');
      setAccounts([]);
      setCategories([]);
      setTransactions([]);
      setEditingId(null);
      setEditingTxId(null);
      setEditingCategoryId(null);
    } catch (err: unknown) {
      setMe(null);
      setMode('unauth');
      setAccounts([]);
      setCategories([]);
      setTransactions([]);
      setEditingId(null);
      setEditingTxId(null);
      setEditingCategoryId(null);
      setError(err instanceof Error ? err.message : 'Logout failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshAccounts() {
    setAccountsLoading(true);
    try {
      const res = await listAccounts();
      setAccounts(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts.');
    } finally {
      setAccountsLoading(false);
    }
  }

  async function refreshCategories() {
    try {
      const res = await listCategories();
      setCategories(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load categories.');
    }
  }

  async function refreshTransactions(nextPage: number = txPage) {
    setTxLoading(true);
    try {
      const res = await listTransactions({
        page: nextPage,
        size: txSize,
        sort: filterSort,
        from: filterFrom || undefined,
        to: filterTo || undefined,
        accountId: parseOptionalInteger(filterAccountId, 'Filter account'),
        type: filterType || undefined,
        categoryId: parseOptionalInteger(filterCategoryId, 'Filter category'),
        needsReview: filterNeedsReview ? true : undefined,
        q: filterQuery || undefined
      });
      setTransactions(res.items);
      setTxPage(res.page);
      setTxTotal(res.totalElements);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions.');
    } finally {
      setTxLoading(false);
    }
  }

  async function onCreateAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const openingBalance = parseNonNegativeInteger(createOpeningBalance, 'Opening balance');
      const orderIndex = parseOptionalInteger(createOrderIndex, 'Order index');
      await createAccount({
        name: createName,
        type: createType,
        openingBalance,
        orderIndex,
        isActive: true
      });
      await refreshAccounts();
      setCreateName('');
      setCreateOpeningBalance('0');
      setCreateOrderIndex('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account.');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(account: AccountResponse) {
    setEditingId(account.id);
    setEditName(account.name);
    setEditIsActive(account.isActive);
    setEditOrderIndex(account.orderIndex == null ? '' : String(account.orderIndex));
  }

  async function onSaveEdit(id: number) {
    setError('');
    setSubmitting(true);
    try {
      const orderIndex = parseOptionalInteger(editOrderIndex, 'Order index');
      await patchAccount(id, {
        name: editName,
        isActive: editIsActive,
        orderIndex
      });
      await refreshAccounts();
      setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update account.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onToggleActive(account: AccountResponse) {
    setError('');
    setSubmitting(true);
    try {
      await patchAccount(account.id, { isActive: !account.isActive });
      await refreshAccounts();
      if (editingId === account.id) {
        setEditingId(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update account.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onCreateCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await createCategory({
        type: categoryType,
        name: categoryName,
        isActive: true
      });
      await refreshCategories();
      setCategoryName('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create category.');
    } finally {
      setSubmitting(false);
    }
  }

  function startCategoryEdit(category: CategoryResponse) {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  }

  async function onSaveCategory(id: number) {
    setError('');
    setSubmitting(true);
    try {
      await patchCategory(id, { name: editingCategoryName });
      await refreshCategories();
      setEditingCategoryId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update category.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onCreateTransaction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const amount = parsePositiveInteger(txAmount, 'Amount');
      const accountId = parseOptionalInteger(txAccountId, 'Account');
      const categoryId = parseOptionalInteger(txCategoryId, 'Category');
      if (accountId == null) {
        throw new Error('Account is required.');
      }
      await createTransaction({
        txDate,
        type: txType,
        amount,
        accountId,
        categoryId,
        description: txDescription,
        needsReview: txNeedsReview,
        excludeFromReports: txExcludeFromReports
      });
      await refreshTransactions(0);
      await refreshAccounts();
      setTxAmount('0');
      setTxDescription('');
      setTxNeedsReview(false);
      setTxExcludeFromReports(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction.');
    } finally {
      setSubmitting(false);
    }
  }

  function startTransactionEdit(tx: TransactionResponse) {
    setEditingTxId(tx.id);
    setEditingTxAmount(String(tx.amount));
    setEditingTxDescription(tx.description);
    setEditingTxNeedsReview(tx.needsReview);
    setEditingTxExclude(tx.excludeFromReports);
  }

  async function onSaveTransaction(id: number) {
    setError('');
    setSubmitting(true);
    try {
      const amount = parsePositiveInteger(editingTxAmount, 'Amount');
      await patchTransaction(id, {
        amount,
        description: editingTxDescription,
        needsReview: editingTxNeedsReview,
        excludeFromReports: editingTxExclude
      });
      await refreshTransactions();
      await refreshAccounts();
      setEditingTxId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update transaction.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onDeleteTransaction(id: number) {
    setError('');
    setSubmitting(true);
    try {
      await deleteTransaction(id);
      await refreshTransactions();
      await refreshAccounts();
      if (editingTxId === id) {
        setEditingTxId(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete transaction.');
    } finally {
      setSubmitting(false);
    }
  }

  const visibleAccounts = useMemo(
    () => (showInactive ? accounts : accounts.filter((a) => a.isActive)),
    [accounts, showInactive]
  );

  const activeAccounts = useMemo(() => accounts.filter((a) => a.isActive), [accounts]);

  const selectableCategories = useMemo(
    () => categories.filter((c) => c.type === txType && c.isActive),
    [categories, txType]
  );

  const txHasPrev = txPage > 0;
  const txHasNext = (txPage + 1) * txSize < txTotal;

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>{title}</h1>
        {mode === 'auth' ? (
          <button type="button" className="btn" onClick={onLogout} disabled={submitting}>Logout</button>
        ) : null}
      </header>

      {error ? <p className="error" role="alert">{error}</p> : null}

      {mode === 'loading' ? <p>Checking session...</p> : null}

      {mode === 'unauth' ? (
        <section>
          <div className="tabs" role="tablist" aria-label="Auth">
            <button
              type="button"
              className={tab === 'login' ? 'tab tab-active' : 'tab'}
              onClick={() => setTab('login')}
              role="tab"
              aria-selected={tab === 'login'}
            >
              Login
            </button>
            <button
              type="button"
              className={tab === 'signup' ? 'tab tab-active' : 'tab'}
              onClick={() => setTab('signup')}
              role="tab"
              aria-selected={tab === 'signup'}
            >
              Sign up
            </button>
          </div>

          <form className="card" onSubmit={onSubmit}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                minLength={tab === 'signup' ? 8 : 1}
              />
            </label>
            <button className="btn btn-primary" type="submit">
              {submitting ? 'Working...' : (tab === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>

          <p className="hint">Dev note: run backend + frontend then use the form. The dev server proxies `/api` to the backend.</p>
        </section>
      ) : null}

      {mode === 'auth' && me ? (
        <section>
          <section className="card">
            <h2>Protected Area</h2>
            <p>
              You are signed in as <strong>{me.email}</strong>.
            </p>
            <ul>
              <li>Session cookie: `JSESSIONID`</li>
              <li>CSRF cookie: `XSRF-TOKEN` (sent via `X-XSRF-TOKEN`)</li>
            </ul>
          </section>

          <section className="card accounts-card">
            <div className="accounts-header">
              <h2>Accounts</h2>
              <label className="toggle-inline">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Show inactive
              </label>
            </div>

            {accountsLoading ? <p>Loading accounts...</p> : null}

            {!accountsLoading && visibleAccounts.length === 0 ? (
              <p className="hint">No accounts yet. Create your first account below.</p>
            ) : null}

            {!accountsLoading && visibleAccounts.length > 0 ? (
              <ul className="account-list">
                {visibleAccounts.map((account) => (
                  <li key={account.id} className="account-item">
                    <div>
                      <strong>{account.name}</strong>
                      <p className="hint">
                        {account.type} · Opening {account.openingBalance.toLocaleString()} KRW · Current {(account.currentBalance ?? 0).toLocaleString()} KRW · {account.isActive ? 'active' : 'inactive'}
                      </p>
                    </div>
                    <div className="account-actions">
                      <button type="button" className="btn" onClick={() => startEdit(account)} disabled={submitting}>Edit</button>
                      <button type="button" className="btn" onClick={() => onToggleActive(account)} disabled={submitting}>
                        {account.isActive ? 'Archive' : 'Activate'}
                      </button>
                    </div>

                    {editingId === account.id ? (
                      <form
                        className="edit-grid"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void onSaveEdit(account.id);
                        }}
                      >
                        <label className="field">
                          <span>Edit name</span>
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={100} required />
                        </label>
                        <label className="field">
                          <span>Edit order index</span>
                          <input type="number" value={editOrderIndex} onChange={(e) => setEditOrderIndex(e.target.value)} />
                        </label>
                        <label className="toggle-inline">
                          <input type="checkbox" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} />
                          Active
                        </label>
                        <div className="account-actions">
                          <button className="btn btn-primary" type="submit" disabled={submitting}>Save</button>
                          <button className="btn" type="button" onClick={() => setEditingId(null)} disabled={submitting}>Cancel</button>
                        </div>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            <form className="card" onSubmit={onCreateAccount}>
              <h3>Create account</h3>
              <label className="field">
                <span>Name</span>
                <input value={createName} onChange={(e) => setCreateName(e.target.value)} maxLength={100} required />
              </label>
              <label className="field">
                <span>Type</span>
                <select value={createType} onChange={(e) => setCreateType(e.target.value as AccountType)}>
                  <option value="CHECKING">CHECKING</option>
                  <option value="SAVINGS">SAVINGS</option>
                  <option value="CASH">CASH</option>
                  <option value="INVESTMENT">INVESTMENT</option>
                </select>
              </label>
              <label className="field">
                <span>Opening balance (KRW)</span>
                <input type="number" min={0} value={createOpeningBalance} onChange={(e) => setCreateOpeningBalance(e.target.value)} />
              </label>
              <label className="field">
                <span>Order index (optional)</span>
                <input type="number" value={createOrderIndex} onChange={(e) => setCreateOrderIndex(e.target.value)} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Working...' : 'Add account'}</button>
            </form>
          </section>

          <section className="card accounts-card">
            <h2>Categories</h2>
            <form className="card" onSubmit={onCreateCategory}>
              <label className="field">
                <span>Category type</span>
                <select value={categoryType} onChange={(e) => setCategoryType(e.target.value as TransactionType)}>
                  <option value="INCOME">INCOME</option>
                  <option value="EXPENSE">EXPENSE</option>
                </select>
              </label>
              <label className="field">
                <span>Category name</span>
                <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} maxLength={100} required />
              </label>
              <button className="btn btn-primary" type="submit" disabled={submitting}>Create category</button>
            </form>

            <ul className="account-list">
              {categories.map((category) => (
                <li key={category.id} className="account-item">
                  <div>
                    <strong>{category.name}</strong>
                    <p className="hint">{category.type} · {category.isActive ? 'active' : 'inactive'}</p>
                  </div>
                  {editingCategoryId === category.id ? (
                    <form
                      className="account-actions"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void onSaveCategory(category.id);
                      }}
                    >
                      <input value={editingCategoryName} onChange={(e) => setEditingCategoryName(e.target.value)} maxLength={100} required />
                      <button className="btn btn-primary" type="submit" disabled={submitting}>Save</button>
                      <button className="btn" type="button" onClick={() => setEditingCategoryId(null)} disabled={submitting}>Cancel</button>
                    </form>
                  ) : (
                    <button className="btn" type="button" onClick={() => startCategoryEdit(category)} disabled={submitting}>Rename</button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="card accounts-card">
            <h2>Transactions</h2>

            <form className="card" onSubmit={onCreateTransaction}>
              <label className="field">
                <span>Date</span>
                <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} required />
              </label>
              <label className="field">
                <span>Type</span>
                <select value={txType} onChange={(e) => setTxType(e.target.value as 'INCOME' | 'EXPENSE')}>
                  <option value="INCOME">INCOME</option>
                  <option value="EXPENSE">EXPENSE</option>
                </select>
              </label>
              <label className="field">
                <span>Amount (KRW)</span>
                <input type="number" min={1} value={txAmount} onChange={(e) => setTxAmount(e.target.value)} required />
              </label>
              <label className="field">
                <span>Account</span>
                <select value={txAccountId} onChange={(e) => setTxAccountId(e.target.value)} required>
                  <option value="">Select account</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={String(a.id)}>{a.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Category (optional)</span>
                <select value={txCategoryId} onChange={(e) => setTxCategoryId(e.target.value)}>
                  <option value="">No category</option>
                  {selectableCategories.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Description</span>
                <input value={txDescription} onChange={(e) => setTxDescription(e.target.value)} maxLength={255} />
              </label>
              <label className="toggle-inline">
                <input type="checkbox" checked={txNeedsReview} onChange={(e) => setTxNeedsReview(e.target.checked)} />
                needsReview
              </label>
              <label className="toggle-inline">
                <input type="checkbox" checked={txExcludeFromReports} onChange={(e) => setTxExcludeFromReports(e.target.checked)} />
                excludeFromReports
              </label>
              <button className="btn btn-primary" type="submit" disabled={submitting}>Add transaction</button>
            </form>

            <form
              className="card"
              onSubmit={(e) => {
                e.preventDefault();
                void refreshTransactions(0);
              }}
            >
              <h3>Filters</h3>
              <label className="field">
                <span>Type</span>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value as '' | TransactionType)}>
                  <option value="">ALL</option>
                  <option value="INCOME">INCOME</option>
                  <option value="EXPENSE">EXPENSE</option>
                </select>
              </label>
              <label className="field">
                <span>Search</span>
                <input value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} placeholder="description contains..." />
              </label>
              <label className="field">
                <span>From date</span>
                <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
              </label>
              <label className="field">
                <span>To date</span>
                <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
              </label>
              <label className="field">
                <span>Account</span>
                <select value={filterAccountId} onChange={(e) => setFilterAccountId(e.target.value)}>
                  <option value="">ALL</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={String(account.id)}>{account.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Category</span>
                <select value={filterCategoryId} onChange={(e) => setFilterCategoryId(e.target.value)}>
                  <option value="">ALL</option>
                  {categories.map((category) => (
                    <option key={category.id} value={String(category.id)}>{category.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Sort</span>
                <select value={filterSort} onChange={(e) => setFilterSort(e.target.value)}>
                  <option value="txDate,desc">Date (newest)</option>
                  <option value="txDate,asc">Date (oldest)</option>
                  <option value="amount,desc">Amount (high-low)</option>
                  <option value="amount,asc">Amount (low-high)</option>
                  <option value="createdAt,desc">Created (newest)</option>
                  <option value="createdAt,asc">Created (oldest)</option>
                </select>
              </label>
              <label className="toggle-inline">
                <input type="checkbox" checked={filterNeedsReview} onChange={(e) => setFilterNeedsReview(e.target.checked)} />
                needsReview only
              </label>
              <button className="btn" type="submit" disabled={submitting}>Apply filters</button>
            </form>

            {txLoading ? <p>Loading transactions...</p> : null}
            {!txLoading && transactions.length === 0 ? <p className="hint">No transactions found.</p> : null}

            {!txLoading && transactions.length > 0 ? (
              <ul className="account-list">
                {transactions.map((tx) => (
                  <li key={tx.id} className="account-item">
                    <div>
                      <strong>{tx.type}</strong>
                      <p className="hint">
                        {tx.txDate} · {tx.amount.toLocaleString()} KRW · {tx.description || '(no description)'}
                      </p>
                    </div>
                    <div className="account-actions">
                      <button type="button" className="btn" onClick={() => startTransactionEdit(tx)} disabled={submitting}>Edit</button>
                      <button type="button" className="btn" onClick={() => onDeleteTransaction(tx.id)} disabled={submitting}>Delete</button>
                    </div>
                    {editingTxId === tx.id ? (
                      <form
                        className="edit-grid"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void onSaveTransaction(tx.id);
                        }}
                      >
                        <label className="field">
                          <span>Amount</span>
                          <input type="number" min={1} value={editingTxAmount} onChange={(e) => setEditingTxAmount(e.target.value)} />
                        </label>
                        <label className="field">
                          <span>Description</span>
                          <input value={editingTxDescription} onChange={(e) => setEditingTxDescription(e.target.value)} maxLength={255} />
                        </label>
                        <label className="toggle-inline">
                          <input type="checkbox" checked={editingTxNeedsReview} onChange={(e) => setEditingTxNeedsReview(e.target.checked)} />
                          needsReview
                        </label>
                        <label className="toggle-inline">
                          <input type="checkbox" checked={editingTxExclude} onChange={(e) => setEditingTxExclude(e.target.checked)} />
                          excludeFromReports
                        </label>
                        <div className="account-actions">
                          <button className="btn btn-primary" type="submit" disabled={submitting}>Save</button>
                          <button className="btn" type="button" onClick={() => setEditingTxId(null)} disabled={submitting}>Cancel</button>
                        </div>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="account-actions">
              <button type="button" className="btn" onClick={() => void refreshTransactions(txPage - 1)} disabled={!txHasPrev || submitting}>Prev</button>
              <span className="hint">Page {txPage + 1}</span>
              <button type="button" className="btn" onClick={() => void refreshTransactions(txPage + 1)} disabled={!txHasNext || submitting}>Next</button>
            </div>
          </section>
        </section>
      ) : null}
    </main>
  );
}
