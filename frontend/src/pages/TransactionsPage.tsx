import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { listTransactions, listAccounts, listCategories, createTransaction, patchTransaction, deleteTransaction, type TransactionResponse, type TransactionType, type AccountResponse, type CategoryResponse } from '../api';
import { useSearchParams } from 'react-router-dom';

function todayISO() { return new Date().toISOString().slice(0, 10); }

function parseOptionalInteger(input: string, fieldName: string): number | undefined {
    const v = input.trim();
    if (v === '') return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`${fieldName} must be an integer.`);
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

    const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
    const [accounts, setAccounts] = useState<AccountResponse[]>([]);
    const [categories, setCategories] = useState<CategoryResponse[]>([]);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Pagination & Filters
    const [txPage, setTxPage] = useState(0);
    const [txSize] = useState(50);
    const [txTotal, setTxTotal] = useState(0);

    const [filterType, setFilterType] = useState<'' | TransactionType>('');
    const [filterNeedsReview, setFilterNeedsReview] = useState(inboxTab);
    const [filterQuery, setFilterQuery] = useState('');
    const [filterAccountId, setFilterAccountId] = useState('');

    // Drawer state
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingTxId, setEditingTxId] = useState<number | null>(null);

    // Form state
    const [txDate, setTxDate] = useState(todayISO());
    const [txType, setTxType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
    const [txAmount, setTxAmount] = useState('0');
    const [txAccountId, setTxAccountId] = useState('');
    const [txCategoryId, setTxCategoryId] = useState('');
    const [txDescription, setTxDescription] = useState('');
    const [txNeedsReview, setTxNeedsReview] = useState(false);
    // Exclude from reports only relevant for EXPENSE
    const [txExcludeFromReports, setTxExcludeFromReports] = useState(false);

    useEffect(() => {
        // Only load accounts and categories once
        Promise.all([listAccounts(), listCategories()]).then(([accRes, catRes]) => {
            setAccounts(accRes.items);
            setCategories(catRes.items);
        }).catch(console.error);
    }, []);

    const loadTransactions = async (page = txPage) => {
        setLoading(true);
        try {
            const res = await listTransactions({
                page,
                size: txSize,
                sort: 'txDate,desc',
                type: filterType || undefined,
                accountId: parseOptionalInteger(filterAccountId, 'Filter account'),
                needsReview: filterNeedsReview ? true : undefined,
                q: filterQuery || undefined
            });
            setTransactions(res.items);
            setTxPage(res.page);
            setTxTotal(res.totalElements);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load transactions.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadTransactions(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterType, filterNeedsReview, filterQuery, filterAccountId]);

    const toggleInbox = (isInbox: boolean) => {
        setFilterNeedsReview(isInbox);
        setSearchParams(isInbox ? { tab: 'inbox' } : {});
    };

    const activeAccounts = useMemo(() => accounts.filter(a => a.isActive), [accounts]);
    const selectableCategories = useMemo(() => categories.filter(c => c.type === txType && c.isActive), [categories, txType]);

    const openNewDrawer = () => {
        setEditingTxId(null);
        setTxDate(todayISO());
        setTxAmount('0');
        setTxDescription('');
        setTxAccountId(activeAccounts.length > 0 ? String(activeAccounts[0].id) : '');
        setTxCategoryId('');
        setTxNeedsReview(false);
        setTxExcludeFromReports(false);
        setDrawerOpen(true);
    };

    const openEditDrawer = (tx: TransactionResponse) => {
        setEditingTxId(tx.id);
        setTxDate(tx.txDate);
        setTxType(tx.type as 'INCOME' | 'EXPENSE');
        setTxAmount(String(tx.amount));
        setTxDescription(tx.description);
        // Account cannot be changed normally or depends on API. We will show but disabled in edit.
        setTxAccountId(String(tx.accountId));
        setTxCategoryId(tx.categoryId ? String(tx.categoryId) : '');
        setTxNeedsReview(tx.needsReview);
        setTxExcludeFromReports(tx.excludeFromReports);
        setDrawerOpen(true);
    };

    const closeDrawer = () => {
        setDrawerOpen(false);
        setEditingTxId(null);
    };

    const handleSaveTransaction = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const amount = parsePositiveInteger(txAmount, 'Amount');
            if (editingTxId) {
                await patchTransaction(editingTxId, {
                    amount,
                    description: txDescription,
                    needsReview: txNeedsReview,
                    excludeFromReports: txType === 'EXPENSE' ? txExcludeFromReports : false
                });
            } else {
                const accountId = parseOptionalInteger(txAccountId, 'Account');
                const categoryId = parseOptionalInteger(txCategoryId, 'Category');
                if (accountId == null) throw new Error('Account is required.');

                await createTransaction({
                    txDate,
                    type: txType,
                    amount,
                    accountId,
                    categoryId,
                    description: txDescription,
                    needsReview: txNeedsReview,
                    excludeFromReports: txType === 'EXPENSE' ? txExcludeFromReports : false
                });
            }
            await loadTransactions(txPage);
            closeDrawer();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Save failed.');
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

    return (
        <div className="page-container transactions-page">
            <div className="page-header">
                <h1 className="page-title">TRANSACTIONS</h1>
                <button className="btn btn-primary" onClick={openNewDrawer}>+ NEW TRANSACTION</button>
            </div>

            <div className="filters-bar">
                <div className="filter-chips">
                    <button className={`chip ${!filterNeedsReview ? 'active' : ''}`} onClick={() => toggleInbox(false)}>All</button>
                    <button className={`chip ${filterNeedsReview ? 'active' : ''}`} onClick={() => toggleInbox(true)}>Inbox (Needs Review)</button>
                    <div className="v-divider" />
                    <select className="chip-select" value={filterType} onChange={(e) => setFilterType(e.target.value as '' | TransactionType)}>
                        <option value="">Type: All</option>
                        <option value="INCOME">Income</option>
                        <option value="EXPENSE">Expense</option>
                    </select>
                    <select className="chip-select" value={filterAccountId} onChange={(e) => setFilterAccountId(e.target.value)}>
                        <option value="">Account: All</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <input className="chip-input" placeholder="Search..." value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} />
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
                                return (
                                    <tr key={tx.id} onClick={() => openEditDrawer(tx)} className="clickable-row">
                                        <td>{tx.txDate}</td>
                                        <td>{tx.description}</td>
                                        <td><span className="pill">{categoryName}</span></td>
                                        <td>
                                            {tx.needsReview ? <span className="text-cyan">Pending</span> : 'Cleared'}
                                        </td>
                                        <td className={`text-right ${tx.type === 'INCOME' ? 'text-cyan' : ''}`}>
                                            {tx.type === 'INCOME' ? '+' : '-'}${tx.amount.toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                <div className="pagination">
                    <button className="btn" disabled={!txHasPrev} onClick={() => loadTransactions(txPage - 1)}>Prev</button>
                    <span>Page {txPage + 1}</span>
                    <button className="btn" disabled={!txHasNext} onClick={() => loadTransactions(txPage + 1)}>Next</button>
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
                            </label>

                            <label className="field">
                                <span>Account</span>
                                <select value={txAccountId} onChange={e => setTxAccountId(e.target.value)} required disabled={!!editingTxId}>
                                    <option value="">Select Account</option>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                                {activeAccounts.length === 0 && !editingTxId && <span className="hint error">You need to create an active account first.</span>}
                            </label>

                            <label className="field">
                                <span>Category</span>
                                <select value={txCategoryId} onChange={e => setTxCategoryId(e.target.value)}>
                                    <option value="">Uncategorized (Needs Review)</option>
                                    {selectableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
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
                                <input type="checkbox" checked={txNeedsReview} onChange={e => setTxNeedsReview(e.target.checked)} />
                                Needs Review
                            </label>

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
