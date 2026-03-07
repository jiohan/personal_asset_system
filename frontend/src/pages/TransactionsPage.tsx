import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    createCategory,
    createTransaction,
    deleteTransaction,
    isApiError,
    listAccounts,
    listCategories,
    listTransactions,
    patchTransaction,
    type AccountResponse,
    type CategoryResponse,
    type TransactionResponse,
    type TransactionType
} from '../api';

function todayISO() { return new Date().toISOString().slice(0, 10); }

function parseOptionalInteger(input: string, fieldName: string): number | undefined {
    const v = input.trim();
    if (v === '') return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`${fieldName} must be an integer.`);
    return n;
}

function parseOptionalIntegerParam(input: string | null): number | undefined {
    if (input == null) return undefined;
    const v = input.trim();
    if (v === '') return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return undefined;
    return n;
}

function parseOptionalStringParam(input: string | null): string | undefined {
    if (input == null) return undefined;
    const v = input.trim();
    return v === '' ? undefined : v;
}

function parseOptionalDateParam(input: string | null): string | undefined {
    const v = parseOptionalStringParam(input);
    if (!v) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
    return v;
}

function parsePageParam(input: string | null): number {
    const n = parseOptionalIntegerParam(input);
    if (n == null || n < 0) return 0;
    return n;
}

function parsePositiveInteger(input: string, fieldName: string): number {
    const v = input.trim();
    const n = Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) throw new Error(`${fieldName} must be a positive integer.`);
    return n;
}

export default function TransactionsPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    const inboxTab = searchParams.get('tab') === 'inbox';
    const urlType = searchParams.get('type');
    const filterType = (urlType === 'INCOME' || urlType === 'EXPENSE') ? (urlType as 'INCOME' | 'EXPENSE') : '';
    const filterQuery = searchParams.get('q') ?? '';
    const filterAccountId = searchParams.get('accountId') ?? '';
    const filterCategoryId = searchParams.get('categoryId') ?? '';
    const filterFrom = searchParams.get('from') ?? '';
    const filterTo = searchParams.get('to') ?? '';
    const txPage = parsePageParam(searchParams.get('page'));
    const txSort = searchParams.get('sort') ?? 'txDate,desc';

    const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
    const [accounts, setAccounts] = useState<AccountResponse[]>([]);
    const [categories, setCategories] = useState<CategoryResponse[]>([]);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string>>({});

    const txSize = 50;
    const [txTotal, setTxTotal] = useState(0);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingTxId, setEditingTxId] = useState<number | null>(null);

    const [txDate, setTxDate] = useState(todayISO());
    const [txType, setTxType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
    const [txAmount, setTxAmount] = useState('0');
    const [txAccountId, setTxAccountId] = useState('');
    const [txCategoryId, setTxCategoryId] = useState('');
    const [txDescription, setTxDescription] = useState('');
    const [txNeedsReview, setTxNeedsReview] = useState(false);
    const [txExcludeFromReports, setTxExcludeFromReports] = useState(false);

    const [inlineCategoryOpen, setInlineCategoryOpen] = useState(false);
    const [inlineCategoryName, setInlineCategoryName] = useState('');
    const [inlineCategorySubmitting, setInlineCategorySubmitting] = useState(false);
    const [inlineCategoryFieldErrors, setInlineCategoryFieldErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        let active = true;
        Promise.all([listAccounts(), listCategories()]).then(([accRes, catRes]) => {
            if (!active) return;
            setAccounts(accRes.items);
            setCategories(catRes.items);
        }).catch((err) => {
            if (!active) return;
            console.error(err);
        });
        return () => { active = false; };
    }, []);

    const refreshCategories = async () => {
        const res = await listCategories();
        setCategories(prev => {
            const byId = new Map<number, CategoryResponse>();
            for (const c of res.items) byId.set(c.id, c);
            for (const c of prev) {
                if (!byId.has(c.id)) byId.set(c.id, c);
            }
            return Array.from(byId.values());
        });
    };

    const loadTransactions = async (page = txPage) => {
        setLoading(true);
        try {
            const res = await listTransactions({
                page,
                size: txSize,
                sort: txSort,
                from: parseOptionalDateParam(filterFrom),
                to: parseOptionalDateParam(filterTo),
                type: filterType || undefined,
                accountId: parseOptionalIntegerParam(searchParams.get('accountId')),
                categoryId: parseOptionalIntegerParam(searchParams.get('categoryId')),
                needsReview: inboxTab ? true : undefined,
                q: filterQuery.trim() ? filterQuery.trim() : undefined
            });
            setTransactions(res.items);
            setTxTotal(res.totalElements);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load transactions.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadTransactions(txPage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inboxTab, filterType, filterQuery, filterAccountId, filterCategoryId, filterFrom, filterTo, txPage, txSort]);

    const updateSearchParam = (key: string, value: string | undefined, options?: { replace?: boolean; resetPage?: boolean }) => {
        const next = new URLSearchParams(searchParams);
        if (!value) next.delete(key);
        else next.set(key, value);
        if (options?.resetPage !== false) next.set('page', '0');
        setSearchParams(next, { replace: options?.replace });
    };

    const toggleInbox = (isInbox: boolean) => {
        const next = new URLSearchParams(searchParams);
        if (isInbox) next.set('tab', 'inbox');
        else next.delete('tab');
        next.set('page', '0');
        setSearchParams(next);
    };

    const goToPage = (page: number) => {
        const next = new URLSearchParams(searchParams);
        next.set('page', String(Math.max(0, page)));
        setSearchParams(next);
    };

    const activeAccounts = useMemo(() => accounts.filter(a => a.isActive), [accounts]);
    const selectableCategories = useMemo(() => categories.filter(c => c.type === txType && c.isActive), [categories, txType]);
    const selectableFilterCategories = useMemo(() => categories.filter(c => c.isActive && (c.type === 'INCOME' || c.type === 'EXPENSE')), [categories]);

    const openNewDrawer = () => {
        setEditingTxId(null);
        setTxDate(todayISO());
        setTxAmount('0');
        setTxDescription('');
        setTxAccountId(activeAccounts.length > 0 ? String(activeAccounts[0].id) : '');
        setTxCategoryId('');
        setTxNeedsReview(false);
        setTxExcludeFromReports(false);
        setFormFieldErrors({});
        setInlineCategoryOpen(false);
        setInlineCategoryName('');
        setInlineCategoryFieldErrors({});
        setDrawerOpen(true);
    };

    const openEditDrawer = (tx: TransactionResponse) => {
        if (tx.type === 'TRANSFER') {
            setError('Transfers are not editable yet (Slice 4).');
            return;
        }
        setEditingTxId(tx.id);
        setTxDate(tx.txDate);
        if (tx.type !== 'INCOME' && tx.type !== 'EXPENSE') {
            setError('Unsupported transaction type.');
            return;
        }
        setTxType(tx.type);
        setTxAmount(String(tx.amount));
        setTxDescription(tx.description);
        setTxAccountId(String(tx.accountId));
        setTxCategoryId(tx.categoryId ? String(tx.categoryId) : '');
        setTxNeedsReview(tx.needsReview);
        setTxExcludeFromReports(tx.excludeFromReports);
        setFormFieldErrors({});
        setInlineCategoryOpen(false);
        setInlineCategoryName('');
        setInlineCategoryFieldErrors({});
        setDrawerOpen(true);
    };

    const closeDrawer = () => {
        setDrawerOpen(false);
        setEditingTxId(null);
        setFormFieldErrors({});
        setInlineCategoryOpen(false);
        setInlineCategoryName('');
        setInlineCategoryFieldErrors({});
    };

    useEffect(() => {
        if (!drawerOpen) return;
        const v = txCategoryId.trim();
        if (!v) return;
        const id = Number(v);
        if (!Number.isFinite(id) || !Number.isInteger(id)) {
            setTxCategoryId('');
            return;
        }
        const selected = categories.find(c => c.id === id);
        if (!selected || selected.type !== txType || !selected.isActive) {
            setTxCategoryId('');
        }
    }, [txType, categories, drawerOpen, txCategoryId]);

    const handleCreateInlineCategory = async () => {
        setError('');
        setInlineCategoryFieldErrors({});

        const name = inlineCategoryName.trim();
        if (!name) {
            setInlineCategoryFieldErrors({ name: 'must not be blank' });
            return;
        }

        setInlineCategorySubmitting(true);
        try {
            const created = await createCategory({ name, type: txType, isActive: true });
            setCategories(prev => (prev.some(c => c.id === created.id) ? prev : [...prev, created]));
            setTxCategoryId(String(created.id));
            setInlineCategoryName('');
            setInlineCategoryOpen(false);

            try {
                await refreshCategories();
            } catch (refreshErr) {
                console.error(refreshErr);
            }
        } catch (err: unknown) {
            if (isApiError(err) && err.fieldErrors) {
                const next: Record<string, string> = {};
                for (const fe of err.fieldErrors) {
                    if (!next[fe.field]) next[fe.field] = fe.reason;
                }
                setInlineCategoryFieldErrors(next);
                setError(err.message);
            } else if (isApiError(err) && err.status === 409) {
                setInlineCategoryFieldErrors({ name: 'already exists' });
                setError(err.message);
            } else {
                setError(err instanceof Error ? err.message : 'Category creation failed.');
            }
        } finally {
            setInlineCategorySubmitting(false);
        }
    };

    const handleSaveTransaction = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setFormFieldErrors({});
        setSubmitting(true);
        try {
            const amount = parsePositiveInteger(txAmount, 'Amount');
            const categoryId = parseOptionalInteger(txCategoryId, 'Category');
            const categoryIsEmpty = txCategoryId.trim() === '';
            const normalizedNeedsReview = categoryIsEmpty ? true : txNeedsReview;
            if (editingTxId) {
                await patchTransaction(editingTxId, {
                    amount,
                    description: txDescription,
                    clearCategory: categoryIsEmpty ? true : undefined,
                    categoryId: categoryIsEmpty ? undefined : categoryId,
                    needsReview: normalizedNeedsReview,
                    excludeFromReports: txType === 'EXPENSE' ? txExcludeFromReports : false
                });
            } else {
                const accountId = parseOptionalInteger(txAccountId, 'Account');
                if (accountId == null) throw new Error('Account is required.');

                await createTransaction({
                    txDate,
                    type: txType,
                    amount,
                    accountId,
                    categoryId: categoryIsEmpty ? null : categoryId,
                    description: txDescription,
                    needsReview: normalizedNeedsReview,
                    excludeFromReports: txType === 'EXPENSE' ? txExcludeFromReports : false
                });
            }
            await loadTransactions(txPage);
            closeDrawer();
        } catch (err: unknown) {
            if (isApiError(err) && err.fieldErrors) {
                const next: Record<string, string> = {};
                for (const fe of err.fieldErrors) {
                    if (!next[fe.field]) next[fe.field] = fe.reason;
                }
                setFormFieldErrors(next);
                setError(err.message);
            } else {
                setError(err instanceof Error ? err.message : 'Save failed.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this transaction?')) return;
        setError('');
        setSubmitting(true);
        try {
            await deleteTransaction(id);
            await loadTransactions(txPage);
            if (editingTxId === id) closeDrawer();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Delete failed.');
        } finally {
            setSubmitting(false);
        }
    };

    const txHasPrev = txPage > 0;
    const txHasNext = (txPage + 1) * txSize < txTotal;

    const categoryIsEmpty = txCategoryId.trim() === '';
    const effectiveNeedsReview = categoryIsEmpty ? true : txNeedsReview;

    return (
        <div className="page-container transactions-page">
            <div className="page-header">
                <h1 className="page-title">TRANSACTIONS</h1>
                <button className="btn btn-primary" onClick={openNewDrawer}>+ NEW TRANSACTION</button>
            </div>

            <div className="filters-bar">
                <div className="filter-chips">
                    <button className={`chip ${!inboxTab ? 'active' : ''}`} onClick={() => toggleInbox(false)}>All</button>
                    <button className={`chip ${inboxTab ? 'active' : ''}`} onClick={() => toggleInbox(true)}>Inbox (Needs Review)</button>
                    <div className="v-divider" />
                    <select className="chip-select" value={filterType} onChange={(e) => updateSearchParam('type', e.target.value || undefined)}>
                        <option value="">Type: All</option>
                        <option value="INCOME">Income</option>
                        <option value="EXPENSE">Expense</option>
                    </select>
                    <select className="chip-select" value={filterAccountId} onChange={(e) => updateSearchParam('accountId', e.target.value || undefined)}>
                        <option value="">Account: All</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <select className="chip-select" value={filterCategoryId} onChange={(e) => updateSearchParam('categoryId', e.target.value || undefined)}>
                        <option value="">Category: All</option>
                        {selectableFilterCategories.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                        ))}
                    </select>
                    <input
                        className="chip-input"
                        placeholder="Search..."
                        value={filterQuery}
                        onChange={(e) => updateSearchParam('q', e.target.value || undefined, { replace: true })}
                    />
                    <input
                        className="chip-input"
                        type="date"
                        value={filterFrom}
                        onChange={(e) => updateSearchParam('from', e.target.value || undefined, { replace: true })}
                        aria-label="From"
                        title="From (inclusive)"
                    />
                    <input
                        className="chip-input"
                        type="date"
                        value={filterTo}
                        onChange={(e) => updateSearchParam('to', e.target.value || undefined, { replace: true })}
                        aria-label="To"
                        title="To (exclusive)"
                    />
                    <select className="chip-select" value={txSort} onChange={(e) => updateSearchParam('sort', e.target.value || undefined)}>
                        <option value="txDate,desc">Sort: Date (newest)</option>
                        <option value="txDate,asc">Sort: Date (oldest)</option>
                        <option value="amount,desc">Sort: Amount (high)</option>
                        <option value="amount,asc">Sort: Amount (low)</option>
                    </select>
                </div>
            </div>

            {error && <p className="error">{error}</p>}

            <div className="table-container card">
                {loading ? <p>Loading transactions...</p> : null}
                {!loading && transactions.length === 0 ? <p className="hint">No transactions match your filters.</p> : null}

                {!loading && transactions.length > 0 && (
                    <table className="flat-table fully-flat">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th className="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map(tx => {
                                const categoryName = categories.find(c => c.id === tx.categoryId)?.name || 'Uncategorized';
                                const amountPrefix = tx.type === 'INCOME' ? '+' : (tx.type === 'EXPENSE' ? '-' : '↔');
                                return (
                                    <tr
                                        key={tx.id}
                                        onClick={() => openEditDrawer(tx)}
                                        className={tx.type === 'TRANSFER' ? 'clickable-row disabled-row' : 'clickable-row'}
                                        title={tx.type === 'TRANSFER' ? 'Transfers are available in Slice 4.' : undefined}
                                    >
                                        <td>{tx.txDate}</td>
                                        <td>{tx.description}</td>
                                        <td><span className="pill">{categoryName}</span></td>
                                        <td>
                                            {tx.needsReview ? <span className="text-cyan">Pending</span> : 'Cleared'}
                                        </td>
                                        <td className={`text-right ${tx.type === 'INCOME' ? 'text-cyan' : ''}`}>
                                            {amountPrefix}{tx.amount.toLocaleString('ko-KR')} KRW
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                <div className="pagination">
                    <button className="btn" disabled={!txHasPrev} onClick={() => goToPage(txPage - 1)}>Prev</button>
                    <span>Page {txPage + 1}</span>
                    <button className="btn" disabled={!txHasNext} onClick={() => goToPage(txPage + 1)}>Next</button>
                </div>
            </div>

            {/* Slide Drawer */}
            <div className={`drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={closeDrawer}>
                <div className="drawer-panel" onClick={e => e.stopPropagation()}>
                    <div className="drawer-header">
                        <h3>{editingTxId ? 'EDIT TRANSACTION' : 'ADD NEW TRANSACTION'}</h3>
                        <button className="btn-icon" onClick={closeDrawer}>✕</button>
                    </div>
                    <div className="drawer-body">
                        <form onSubmit={handleSaveTransaction}>
                            <div className="form-group-type">
                                <button type="button" className={`btn-type ${txType === 'INCOME' ? 'active' : ''}`} onClick={() => setTxType('INCOME')} disabled={!!editingTxId}>
                                    INCOME
                                </button>
                                <button type="button" className={`btn-type ${txType === 'EXPENSE' ? 'active' : ''}`} onClick={() => setTxType('EXPENSE')} disabled={!!editingTxId}>
                                    EXPENSE
                                </button>
                            </div>

                            <label className="field">
                                <span>Amount</span>
                                <input type="number" min="1" value={txAmount} onChange={e => setTxAmount(e.target.value)} required />
                                {formFieldErrors.amount ? <span className="hint error">{formFieldErrors.amount}</span> : null}
                            </label>

                            <label className="field">
                                <span>Account</span>
                                <select value={txAccountId} onChange={e => setTxAccountId(e.target.value)} required disabled={!!editingTxId}>
                                    <option value="">Select Account</option>
                                    {(editingTxId ? accounts : activeAccounts).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                                {activeAccounts.length === 0 && !editingTxId && <span className="hint error">You need to create an active account first.</span>}
                                {formFieldErrors.accountId ? <span className="hint error">{formFieldErrors.accountId}</span> : null}
                            </label>

                            <label className="field">
                                <span>Category</span>
                                <select value={txCategoryId} onChange={e => setTxCategoryId(e.target.value)}>
                                    <option value="">Uncategorized (Needs Review)</option>
                                    {selectableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                {formFieldErrors.categoryId ? <span className="hint error">{formFieldErrors.categoryId}</span> : null}

                                {!editingTxId && (
                                    <div className="mt-1">
                                        <button
                                            type="button"
                                            className="btn btn-sm"
                                            onClick={() => {
                                                setInlineCategoryOpen(v => !v);
                                                setInlineCategoryFieldErrors({});
                                                setInlineCategoryName('');
                                            }}
                                            disabled={submitting || inlineCategorySubmitting}
                                        >
                                            {inlineCategoryOpen ? 'Cancel new category' : '+ Add new category'}
                                        </button>
                                    </div>
                                )}

                                {!editingTxId && inlineCategoryOpen && (
                                    <div className="inline-add-form inline-add-compact mt-1" aria-label="Inline category create">
                                        <input
                                            aria-label="New category name"
                                            placeholder={`New ${txType.toLowerCase()} category...`}
                                            value={inlineCategoryName}
                                            onChange={(e) => setInlineCategoryName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    void handleCreateInlineCategory();
                                                }
                                            }}
                                            maxLength={100}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={() => { void handleCreateInlineCategory(); }}
                                            disabled={inlineCategorySubmitting || submitting}
                                        >
                                            Add
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-sm"
                                            onClick={() => {
                                                setInlineCategoryOpen(false);
                                                setInlineCategoryName('');
                                                setInlineCategoryFieldErrors({});
                                            }}
                                            disabled={inlineCategorySubmitting || submitting}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}

                                {!editingTxId && inlineCategoryOpen && inlineCategoryFieldErrors.name ? (
                                    <span className="hint error block">{inlineCategoryFieldErrors.name}</span>
                                ) : null}
                            </label>

                            <label className="field">
                                <span>Date</span>
                                <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} required disabled={!!editingTxId} />
                            </label>

                            <label className="field">
                                <span>Notes (Description)</span>
                                <input value={txDescription} onChange={e => setTxDescription(e.target.value)} />
                            </label>

                            <label className="toggle-inline mt-2">
                                <input type="checkbox" checked={effectiveNeedsReview} onChange={e => setTxNeedsReview(e.target.checked)} disabled={categoryIsEmpty} />
                                Needs Review
                            </label>

                            {categoryIsEmpty && (
                                <p className="hint">Uncategorized transactions are always stored as <strong>Needs Review</strong>.</p>
                            )}

                            {txType === 'EXPENSE' && (
                                <label className="toggle-inline">
                                    <input type="checkbox" checked={txExcludeFromReports} onChange={e => setTxExcludeFromReports(e.target.checked)} />
                                    Exclude from reports
                                </label>
                            )}

                            <div className="drawer-footer">
                                <button type="submit" className="btn btn-primary full-width" disabled={submitting || (activeAccounts.length === 0 && !editingTxId)}>COMMIT ENTRY</button>
                                {editingTxId && (
                                    <button type="button" className="btn btn-danger full-width mt-1" onClick={() => handleDelete(editingTxId)} disabled={submitting}>DELETE</button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
