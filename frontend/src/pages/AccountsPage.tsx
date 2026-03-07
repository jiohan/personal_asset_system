import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createAccount, isApiError, listAccounts, patchAccount, type AccountResponse, type AccountType } from '../api';

function parseOptionalInteger(input: string, fieldName: string): number | undefined {
    const v = input.trim();
    if (v === '') return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`${fieldName} must be an integer.`);
    return n;
}

function parseNonNegativeInteger(input: string, fieldName: string): number {
    const v = input.trim();
    const n = Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) throw new Error(`${fieldName} must be a non-negative integer.`);
    return n;
}

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<AccountResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});
    const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});

    const [isCreating, setIsCreating] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createType, setCreateType] = useState<AccountType>('CHECKING');
    const [createOpeningBalance, setCreateOpeningBalance] = useState('0');

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const res = await listAccounts();
            setAccounts(res.items);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load accounts.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let active = true;
        async function initLoad() {
            setLoading(true);
            try {
                const res = await listAccounts();
                if (!active) return;
                setAccounts(res.items);
            } catch (err: unknown) {
                if (!active) return;
                setError(err instanceof Error ? err.message : 'Failed to load accounts.');
            } finally {
                if (active) setLoading(false);
            }
        }

        void initLoad();
        return () => { active = false; };
    }, []);

    const handleCreateAccount = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setCreateFieldErrors({});
        setSubmitting(true);
        try {
            const openingBalance = parseNonNegativeInteger(createOpeningBalance, 'Opening balance');
            await createAccount({ name: createName, type: createType, openingBalance, isActive: true });
            await loadAccounts();
            setCreateName('');
            setCreateOpeningBalance('0');
            setIsCreating(false);
        } catch (err: unknown) {
            if (isApiError(err) && err.fieldErrors) {
                const next: Record<string, string> = {};
                for (const fe of err.fieldErrors) {
                    if (!next[fe.field]) next[fe.field] = fe.reason;
                }
                setCreateFieldErrors(next);
                setError(err.message);
            } else {
                setError(err instanceof Error ? err.message : 'Creation failed.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleActive = async (account: AccountResponse) => {
        setError('');
        setSubmitting(true);
        try {
            await patchAccount(account.id, { isActive: !account.isActive });
            await loadAccounts();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Update failed.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveEdit = async (id: number) => {
        setError('');
        setEditFieldErrors({});
        setSubmitting(true);
        try {
            await patchAccount(id, { name: editName });
            await loadAccounts();
            setEditingId(null);
        } catch (err: unknown) {
            if (isApiError(err) && err.fieldErrors) {
                const next: Record<string, string> = {};
                for (const fe of err.fieldErrors) {
                    if (!next[fe.field]) next[fe.field] = fe.reason;
                }
                setEditFieldErrors(next);
                setError(err.message);
            } else {
                setError(err instanceof Error ? err.message : 'Update failed.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const startEdit = (acc: AccountResponse) => {
        setEditingId(acc.id);
        setEditName(acc.name);
        setEditFieldErrors({});
    };

    const checkingAccounts = useMemo(() => accounts.filter(a => a.type === 'CHECKING'), [accounts]);
    const savingsAccounts = useMemo(() => accounts.filter(a => a.type === 'SAVINGS'), [accounts]);
    const cashAccounts = useMemo(() => accounts.filter(a => a.type === 'CASH'), [accounts]);
    const investmentAccounts = useMemo(() => accounts.filter(a => a.type === 'INVESTMENT'), [accounts]);

    const renderAccountGroup = (title: string, groupAccounts: AccountResponse[]) => {
        if (groupAccounts.length === 0) return null;
        return (
            <div className="account-group">
                <h3 className="group-title">{title}</h3>
                <div className="card-grid">
                    {groupAccounts.map(acc => (
                        <div key={acc.id} className={`card flat-card ${!acc.isActive ? 'inactive' : ''}`}>
                            <div className="card-header">
                                {editingId === acc.id ? (
                                    <form onSubmit={(e) => { e.preventDefault(); void handleSaveEdit(acc.id); }} className="inline-edit-form">
                                        <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} required maxLength={100} />
                                        {editFieldErrors.name ? <span className="hint error">{editFieldErrors.name}</span> : null}
                                        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>💾</button>
                                        <button type="button" className="btn btn-sm" onClick={() => setEditingId(null)}>✕</button>
                                    </form>
                                ) : (
                                    <>
                                        <h4>{acc.name}</h4>
                                        <button className="btn-icon" onClick={() => startEdit(acc)}>✎</button>
                                    </>
                                )}
                            </div>
                            <div className="card-body">
                                <span className="balance-label">Balance</span>
                                <span className="balance-value">{(acc.currentBalance ?? 0).toLocaleString('ko-KR')} KRW</span>
                            </div>
                            <div className="card-footer">
                                <label className="toggle-switch">
                                    <input type="checkbox" checked={acc.isActive} onChange={() => handleToggleActive(acc)} disabled={submitting} />
                                    <span className="slider"></span>
                                    <span className="toggle-label">{acc.isActive ? 'Active' : 'Archived'}</span>
                                </label>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="page-container accounts-page">
            <div className="page-header">
                <h1 className="page-title">Manage Accounts</h1>
                <button className="btn btn-primary" onClick={() => setIsCreating(true)}>+ ADD ACCOUNT</button>
            </div>

            {error && <p className="error">{error}</p>}

            {isCreating && (
                <form className="card create-form" onSubmit={handleCreateAccount}>
                    <h3>New Account</h3>
                    <div className="form-row">
                        <label className="field">
                            <span>Name</span>
                            <input value={createName} onChange={(e) => setCreateName(e.target.value)} required maxLength={100} />
                            {createFieldErrors.name ? <span className="hint error">{createFieldErrors.name}</span> : null}
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
                            <span>Opening Balance (KRW)</span>
                            <input type="number" min="0" value={createOpeningBalance} onChange={(e) => setCreateOpeningBalance(e.target.value)} />
                            {createFieldErrors.openingBalance ? <span className="hint error">{createFieldErrors.openingBalance}</span> : null}
                        </label>
                        <div className="form-actions align-bottom">
                            <button type="submit" className="btn btn-primary" disabled={submitting}>CREATE</button>
                            <button type="button" className="btn" onClick={() => setIsCreating(false)}>CANCEL</button>
                        </div>
                    </div>
                </form>
            )}

            {loading ? (
                <p>Loading accounts...</p>
            ) : accounts.length === 0 ? (
                <p className="hint">No accounts configured yet.</p>
            ) : (
                <div className="accounts-lists">
                    {renderAccountGroup('Checking', checkingAccounts)}
                    {renderAccountGroup('Savings', savingsAccounts)}
                    {renderAccountGroup('Cash', cashAccounts)}
                    {renderAccountGroup('Investment', investmentAccounts)}
                </div>
            )}
        </div>
    );
}
