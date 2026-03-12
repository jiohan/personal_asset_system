import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createAccount,
  isApiError,
  listAccounts,
  patchAccount,
  type AccountResponse,
  type AccountType
} from '../api';
import StateNotice from '../components/StateNotice';
import StatusBadge from '../components/StatusBadge';

type EditableAccount = {
  id: number;
  name: string;
  orderIndex: string;
};

function parseOptionalNonNegativeInteger(input: string, fieldName: string): number | undefined {
  const value = input.trim();
  if (value === '') return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }

  return parsed;
}

function parseNonNegativeInteger(input: string, fieldName: string): number {
  const parsed = parseOptionalNonNegativeInteger(input, fieldName);
  if (parsed == null) {
    throw new Error(`${fieldName} is required.`);
  }
  return parsed;
}

function formatKrw(value: number): string {
  return `${value.toLocaleString('ko-KR')} KRW`;
}

function accountTypeLabel(type: AccountType): string {
  switch (type) {
    case 'CHECKING':
      return 'Checking';
    case 'SAVINGS':
      return 'Savings';
    case 'CASH':
      return 'Cash';
    case 'INVESTMENT':
      return 'Investment';
    default:
      return type;
  }
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<AccountType>('CHECKING');
  const [createOpeningBalance, setCreateOpeningBalance] = useState('0');
  const [createOrderIndex, setCreateOrderIndex] = useState('');
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});

  const [editRow, setEditRow] = useState<EditableAccount | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});

  const loadAccounts = async () => {
    const response = await listAccounts();
    setAccounts(response.items);
  };

  useEffect(() => {
    let active = true;

    async function initLoad() {
      setLoading(true);
      setError('');
      try {
        const response = await listAccounts();
        if (!active) return;
        setAccounts(response.items);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load accounts.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void initLoad();
    return () => {
      active = false;
    };
  }, []);

  const orderedAccounts = useMemo(
    () => [...accounts].sort((left, right) => {
      if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;

      const leftOrder = left.orderIndex ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.orderIndex ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;

      const byType = accountTypeLabel(left.type).localeCompare(accountTypeLabel(right.type));
      if (byType !== 0) return byType;

      return left.name.localeCompare(right.name);
    }),
    [accounts]
  );

  const activeCount = useMemo(() => accounts.filter((account) => account.isActive).length, [accounts]);
  const archivedCount = accounts.length - activeCount;
  const liveBalanceTotal = useMemo(
    () => accounts.reduce((sum, account) => sum + (account.currentBalance ?? account.openingBalance), 0),
    [accounts]
  );

  const resetCreateForm = () => {
    setCreateName('');
    setCreateType('CHECKING');
    setCreateOpeningBalance('0');
    setCreateOrderIndex('');
    setCreateFieldErrors({});
  };

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setCreateFieldErrors({});
    setSubmitting(true);

    try {
      const openingBalance = parseNonNegativeInteger(createOpeningBalance, 'Opening balance');
      const orderIndex = parseOptionalNonNegativeInteger(createOrderIndex, 'Order index');

      await createAccount({
        name: createName.trim(),
        type: createType,
        openingBalance,
        isActive: true,
        ...(orderIndex != null ? { orderIndex } : {})
      });

      await loadAccounts();
      resetCreateForm();
      setIsCreating(false);
      setSuccessMessage('Account row added to the library.');
    } catch (err: unknown) {
      if (isApiError(err) && err.fieldErrors) {
        const nextErrors: Record<string, string> = {};
        for (const fieldError of err.fieldErrors) {
          if (!nextErrors[fieldError.field]) nextErrors[fieldError.field] = fieldError.reason;
        }
        setCreateFieldErrors(nextErrors);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Account creation failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (account: AccountResponse) => {
    setError('');
    setSuccessMessage('');
    setSubmitting(true);

    try {
      await patchAccount(account.id, { isActive: !account.isActive });
      await loadAccounts();
      setSuccessMessage('Account status updated.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Account update failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (account: AccountResponse) => {
    setEditFieldErrors({});
    setEditRow({
      id: account.id,
      name: account.name,
      orderIndex: account.orderIndex == null ? '' : String(account.orderIndex)
    });
  };

  const handleSaveEdit = async (accountId: number) => {
    if (!editRow || editRow.id !== accountId) return;

    setError('');
    setSuccessMessage('');
    setEditFieldErrors({});
    setSubmitting(true);

    try {
      const orderIndex = parseOptionalNonNegativeInteger(editRow.orderIndex, 'Order index');
      await patchAccount(accountId, {
        name: editRow.name.trim(),
        ...(orderIndex != null ? { orderIndex } : {})
      });

      await loadAccounts();
      setEditRow(null);
      setSuccessMessage('Account row updated.');
    } catch (err: unknown) {
      if (isApiError(err) && err.fieldErrors) {
        const nextErrors: Record<string, string> = {};
        for (const fieldError of err.fieldErrors) {
          if (!nextErrors[fieldError.field]) nextErrors[fieldError.field] = fieldError.reason;
        }
        setEditFieldErrors(nextErrors);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Account update failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container accounts-page management-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">Library</p>
          <h1 className="page-title">Ledger Accounts</h1>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setIsCreating((value) => !value)}>
          {isCreating ? 'Close Row' : 'New Row'}
        </button>
      </div>

      <section className="management-overview-grid">
        <article className="card management-metric-card">
          <span className="page-kicker">Total Accounts</span>
          <strong>{accounts.length.toLocaleString('ko-KR')}</strong>
        </article>
        <article className="card management-metric-card">
          <span className="page-kicker">Active</span>
          <strong>{activeCount.toLocaleString('ko-KR')}</strong>
        </article>
        <article className="card management-metric-card">
          <span className="page-kicker">Archived</span>
          <strong>{archivedCount.toLocaleString('ko-KR')}</strong>
        </article>
        <article className="card management-metric-card accent">
          <span className="page-kicker">Live Balance</span>
          <strong>{formatKrw(liveBalanceTotal)}</strong>
        </article>
      </section>

      {error ? (
        <StateNotice tone="error" title="Could not update the account library." description={error} compact />
      ) : null}
      {successMessage ? (
        <StateNotice tone="success" title={successMessage} compact />
      ) : null}

      <div className="management-shell">
        {isCreating ? (
          <section className="card management-create-card">
            <div className="management-toolbar">
              <div>
                <p className="page-kicker">Quick Add</p>
                <h3>New Account Row</h3>
              </div>
            </div>
            <form className="management-create-grid" onSubmit={handleCreateAccount}>
              <label className="field">
                <span>Account Name</span>
                <input
                  aria-label="Account name"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  required
                  maxLength={100}
                />
                {createFieldErrors.name ? <span className="hint error">{createFieldErrors.name}</span> : null}
              </label>
              <label className="field">
                <span>Account Type</span>
                <select
                  aria-label="Account type"
                  value={createType}
                  onChange={(event) => setCreateType(event.target.value as AccountType)}
                >
                  <option value="CHECKING">Checking</option>
                  <option value="SAVINGS">Savings</option>
                  <option value="CASH">Cash</option>
                  <option value="INVESTMENT">Investment</option>
                </select>
              </label>
              <label className="field">
                <span>Opening Balance (KRW)</span>
                <input
                  aria-label="Opening balance (KRW)"
                  inputMode="numeric"
                  value={createOpeningBalance}
                  onChange={(event) => setCreateOpeningBalance(event.target.value)}
                />
                {createFieldErrors.openingBalance ? <span className="hint error">{createFieldErrors.openingBalance}</span> : null}
              </label>
              <label className="field">
                <span>Order Index</span>
                <input
                  aria-label="Order index"
                  inputMode="numeric"
                  placeholder="auto"
                  value={createOrderIndex}
                  onChange={(event) => setCreateOrderIndex(event.target.value)}
                />
                {createFieldErrors.orderIndex ? <span className="hint error">{createFieldErrors.orderIndex}</span> : null}
              </label>
              <div className="management-form-actions">
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    resetCreateForm();
                    setIsCreating(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        ) : (
          <StateNotice
            tone="disabled"
            title="Quick add row is collapsed."
            description="Open a new row when you need to register another account."
            action={(
              <button className="btn btn-primary" type="button" onClick={() => setIsCreating(true)}>
                Open Row
              </button>
            )}
          />
        )}

        <section className="card management-main-card">
          <div className="management-toolbar">
            <div>
              <p className="page-kicker">Dense View</p>
              <h3>Scan, rename, archive</h3>
            </div>
            <p className="management-section-note">Active rows stay on top. Order index keeps the library stable.</p>
          </div>

          {loading ? (
            <StateNotice
              tone="loading"
              title="Loading account library."
              description="Balances and activation status are being refreshed."
            />
          ) : null}

          {!loading && orderedAccounts.length === 0 ? (
            <StateNotice
              tone="empty"
              title="No accounts yet."
              description="Create your first ledger account to start recording transactions."
              action={(
                <button className="btn btn-primary" type="button" onClick={() => setIsCreating(true)}>
                  Add First Account
                </button>
              )}
            />
          ) : null}

          {!loading && orderedAccounts.length > 0 ? (
            <div className="management-table-wrap">
              <table className="flat-table management-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Type</th>
                    <th>Live Balance</th>
                    <th>Opening</th>
                    <th>Status</th>
                    <th>Order</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedAccounts.map((account) => {
                    const isEditing = editRow?.id === account.id;
                    return (
                      <tr key={account.id} className={!account.isActive ? 'management-row-archived' : undefined}>
                        <td>
                          {isEditing ? (
                            <label className="management-inline-stack">
                              <span className="sr-only">Edit name for {account.name}</span>
                              <input
                                className="management-inline-input"
                                aria-label={`Edit name for ${account.name}`}
                                value={editRow.name}
                                onChange={(event) => setEditRow((current) => (
                                  current ? { ...current, name: event.target.value } : current
                                ))}
                                maxLength={100}
                              />
                              {editFieldErrors.name ? <span className="hint error">{editFieldErrors.name}</span> : null}
                            </label>
                          ) : (
                            <div className="management-row-label">
                              <strong>{account.name}</strong>
                            </div>
                          )}
                        </td>
                        <td><StatusBadge tone="info">{accountTypeLabel(account.type)}</StatusBadge></td>
                        <td className="management-number">{formatKrw(account.currentBalance ?? account.openingBalance)}</td>
                        <td className="management-number">{formatKrw(account.openingBalance)}</td>
                        <td>
                          <StatusBadge tone={account.isActive ? 'success' : 'warning'}>
                            {account.isActive ? 'Active' : 'Archived'}
                          </StatusBadge>
                        </td>
                        <td>
                          {isEditing ? (
                            <label className="management-inline-stack">
                              <span className="sr-only">Edit order for {account.name}</span>
                              <input
                                className="management-inline-input"
                                aria-label={`Edit order for ${account.name}`}
                                inputMode="numeric"
                                placeholder="auto"
                                value={editRow.orderIndex}
                                onChange={(event) => setEditRow((current) => (
                                  current ? { ...current, orderIndex: event.target.value } : current
                                ))}
                              />
                              {editFieldErrors.orderIndex ? <span className="hint error">{editFieldErrors.orderIndex}</span> : null}
                            </label>
                          ) : (
                            <span>{account.orderIndex == null ? 'Auto' : account.orderIndex}</span>
                          )}
                        </td>
                        <td>
                          <div className="management-row-actions">
                            {isEditing ? (
                              <>
                                <button
                                  className="btn btn-primary btn-sm"
                                  type="button"
                                  disabled={submitting}
                                  onClick={() => {
                                    void handleSaveEdit(account.id);
                                  }}
                                >
                                  Save
                                </button>
                                <button className="btn btn-sm" type="button" onClick={() => setEditRow(null)}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  disabled={submitting}
                                  aria-label={`Edit ${account.name}`}
                                  onClick={() => startEdit(account)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  disabled={submitting}
                                  aria-label={`${account.isActive ? 'Archive' : 'Restore'} ${account.name}`}
                                  onClick={() => {
                                    void handleToggleActive(account);
                                  }}
                                >
                                  {account.isActive ? 'Archive' : 'Restore'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
