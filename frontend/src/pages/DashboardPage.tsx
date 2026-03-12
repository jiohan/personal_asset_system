import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  getCashflowTrend,
  getReportSummary,
  listAccounts,
  listCategories,
  listTransactions,
  type AccountResponse,
  type CashflowTrendResponse,
  type CategoryResponse,
  type ReportSummaryResponse,
  type TransactionResponse
} from '../api';
import QuickEntryComposer from '../components/QuickEntryComposer';
import { SparkBars } from '../components/TrendCharts';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function isoLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function todayISO(): string {
  return isoLocalDate(new Date());
}

function monthStartISO(): string {
  const now = new Date();
  return isoLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function formatSignedKrw(amount: number): string {
  const prefix = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${prefix}${Math.abs(amount).toLocaleString('ko-KR')} KRW`;
}

function transactionAccountLabel(tx: TransactionResponse, accountNameById: Map<number, string>): string {
  if (tx.type === 'TRANSFER') {
    const fromLabel = tx.fromAccountId ? (accountNameById.get(tx.fromAccountId) ?? `#${tx.fromAccountId}`) : '-';
    const toLabel = tx.toAccountId ? (accountNameById.get(tx.toAccountId) ?? `#${tx.toAccountId}`) : '-';
    return `${fromLabel} -> ${toLabel}`;
  }

  return tx.accountId ? (accountNameById.get(tx.accountId) ?? `#${tx.accountId}`) : '-';
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [summary, setSummary] = useState<ReportSummaryResponse | null>(null);
  const [cashflow, setCashflow] = useState<CashflowTrendResponse | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<TransactionResponse[]>([]);
  const [inboxTransactions, setInboxTransactions] = useState<TransactionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const from = monthStartISO();
  const to = todayISO();

  const loadDashboard = async () => {
    setLoading(true);
    setError('');

    try {
      const [accountRes, categoryRes, summaryRes, cashflowRes, recentRes, inboxRes] = await Promise.all([
        listAccounts(),
        listCategories(),
        getReportSummary({ from, to }),
        getCashflowTrend({ from, to }),
        listTransactions({ page: 0, size: 8, sort: 'txDate,desc' }),
        listTransactions({ page: 0, size: 5, sort: 'txDate,desc', needsReview: true })
      ]);

      setAccounts(accountRes.items);
      setCategories(categoryRes.items);
      setSummary(summaryRes);
      setCashflow(cashflowRes);
      setRecentTransactions(recentRes.items);
      setInboxTransactions(inboxRes.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const activeAccounts = useMemo(() => accounts.filter((account) => account.isActive), [accounts]);

  const accountNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const account of accounts) map.set(account.id, account.name);
    return map;
  }, [accounts]);

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const category of categories) map.set(category.id, category.name);
    return map;
  }, [categories]);

  const suggestedCategoryIds = useMemo(() => {
    const ids: number[] = [];
    for (const tx of recentTransactions) {
      if (tx.categoryId == null) continue;
      if (ids.includes(tx.categoryId)) continue;
      ids.push(tx.categoryId);
      if (ids.length >= 6) break;
    }
    return ids;
  }, [recentTransactions]);

  const sparkItems = useMemo(
    () => (cashflow?.items ?? []).slice(-30).map((item) => ({
      label: item.date.slice(5),
      value: item.net
    })),
    [cashflow]
  );

  const currentBalanceTotal = useMemo(
    () => activeAccounts.reduce((sum, account) => sum + (account.currentBalance ?? account.openingBalance), 0),
    [activeAccounts]
  );

  return (
    <div className="page-container dashboard-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">Morning Review</p>
          <h1 className="page-title">Control Center</h1>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="dashboard-control-grid">
        <section className="card dashboard-hero-card">
          <div className="dashboard-hero-top">
            <div>
              <p className="page-kicker">This Month</p>
              <h2>Net Cashflow</h2>
            </div>
            <span className={`dashboard-hero-pill ${(summary?.netSaving ?? 0) >= 0 ? 'positive' : 'negative'}`}>
              {loading || !summary ? '...' : formatSignedKrw(summary.netSaving)}
            </span>
          </div>

          <p className="dashboard-hero-value">
            {loading || !summary ? '...' : `${summary.netSaving.toLocaleString('ko-KR')} KRW`}
          </p>

          <div className="dashboard-kpi-row">
            <article className="dashboard-kpi">
              <span>Income</span>
              <strong className="kpi-positive">{loading || !summary ? '...' : `${summary.totalIncome.toLocaleString('ko-KR')} KRW`}</strong>
            </article>
            <article className="dashboard-kpi">
              <span>Expense</span>
              <strong>{loading || !summary ? '...' : `${summary.totalExpense.toLocaleString('ko-KR')} KRW`}</strong>
            </article>
            <article className="dashboard-kpi">
              <span>Transfer</span>
              <strong>{loading || !summary ? '...' : `${summary.transferVolume.toLocaleString('ko-KR')} KRW`}</strong>
            </article>
            <article className="dashboard-kpi">
              <span>Live Balance</span>
              <strong>{loading ? '...' : `${currentBalanceTotal.toLocaleString('ko-KR')} KRW`}</strong>
            </article>
          </div>

          <div className="dashboard-trend-panel">
            <div className="dashboard-panel-head">
              <div>
                <h3>30-Day Rhythm</h3>
                <p className="hint">Positive days stay cyan. Negative days stay quiet.</p>
              </div>
            </div>
            <SparkBars items={sparkItems} emptyLabel="No cashflow trend yet." />
          </div>
        </section>

        <div className="dashboard-side-stack">
          <QuickEntryComposer
            accounts={accounts}
            categories={categories}
            title="Quick Entry"
            description="Amount -> merchant -> account/category. Use it for the fast path, then clean up inbox."
            actionLabel="Record Entry"
            onSaved={loadDashboard}
            suggestedCategoryIds={suggestedCategoryIds}
          />

          <section className="card dashboard-inbox-card">
            <div className="dashboard-panel-head">
              <div>
                <p className="page-kicker">Inbox</p>
                <h3>Needs Review</h3>
              </div>
              <NavLink to="/transactions?tab=inbox" className="btn btn-primary">
                Open Inbox
              </NavLink>
            </div>

            {loading ? <p className="hint">Loading inbox queue...</p> : null}
            {!loading && inboxTransactions.length === 0 ? <p className="hint">Inbox is clear. New uncategorized rows will appear here.</p> : null}

            {!loading && inboxTransactions.length > 0 ? (
              <ul className="dashboard-inbox-list">
                {inboxTransactions.map((tx) => (
                  <li key={tx.id}>
                    <div>
                      <strong>{tx.description.trim() || 'Untitled transaction'}</strong>
                      <p className="hint">
                        {tx.txDate} · {transactionAccountLabel(tx, accountNameById)}
                      </p>
                    </div>
                    <span className={`dashboard-amount ${tx.type === 'INCOME' ? 'income' : 'expense'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}
                      {tx.amount.toLocaleString('ko-KR')} KRW
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      </div>

      <div className="dashboard-bottom-grid">
        <section className="card">
          <div className="dashboard-panel-head">
            <div>
              <p className="page-kicker">Recent Ledger</p>
              <h3>Latest Transactions</h3>
            </div>
            <NavLink to="/transactions" className="btn">
              Open Workspace
            </NavLink>
          </div>

          {loading ? <p className="hint">Loading recent transactions...</p> : null}
          {!loading && recentTransactions.length === 0 ? <p className="hint">No recent transactions.</p> : null}

          {!loading && recentTransactions.length > 0 ? (
            <table className="flat-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Account</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.txDate}</td>
                    <td>{tx.description || 'Untitled'}</td>
                    <td>{tx.categoryId ? (categoryNameById.get(tx.categoryId) ?? 'Unknown') : 'Inbox'}</td>
                    <td>{transactionAccountLabel(tx, accountNameById)}</td>
                    <td className={tx.type === 'INCOME' ? 'text-cyan' : ''}>
                      {tx.type === 'TRANSFER' ? '↔' : tx.type === 'INCOME' ? '+' : '-'}
                      {tx.amount.toLocaleString('ko-KR')} KRW
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        <section className="card dashboard-balance-card">
          <div className="dashboard-panel-head">
            <div>
              <p className="page-kicker">Accounts</p>
              <h3>Active Balance Lanes</h3>
            </div>
            <NavLink to="/accounts" className="btn">
              Manage Accounts
            </NavLink>
          </div>

          {loading ? <p className="hint">Loading accounts...</p> : null}
          {!loading && activeAccounts.length === 0 ? <p className="hint">Create an account to start tracking balances.</p> : null}

          {!loading && activeAccounts.length > 0 ? (
            <ul className="dashboard-balance-list">
              {activeAccounts.map((account) => (
                <li key={account.id}>
                  <div>
                    <strong>{account.name}</strong>
                    <p className="hint">{account.type}</p>
                  </div>
                  <span>{(account.currentBalance ?? account.openingBalance).toLocaleString('ko-KR')} KRW</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
