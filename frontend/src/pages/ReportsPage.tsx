import { useEffect, useMemo, useState } from 'react';
import {
  getAccountBalanceTrend,
  getCashflowTrend,
  getReportSummary,
  getTopExpenseCategories,
  getTransferReport,
  listAccounts,
  type AccountBalanceTrendResponse,
  type AccountResponse,
  type CashflowTrendResponse,
  type ReportSummaryResponse,
  type TopExpenseCategoriesResponse,
  type TransferReportResponse
} from '../api';
import { LineTrendChart, SparkBars } from '../components/TrendCharts';

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function isoLocalDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function monthEndISO(year: number, monthIndex: number) {
  return isoLocalDate(new Date(year, monthIndex + 1, 0));
}

function todayISO() {
  return isoLocalDate(new Date());
}

function monthStartISO() {
  const now = new Date();
  return isoLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function currentMonthRange() {
  const now = new Date();
  return {
    from: isoLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: isoLocalDate(now)
  };
}

function lastMonthRange() {
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const monthIndex = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  return {
    from: isoLocalDate(new Date(year, monthIndex, 1)),
    to: monthEndISO(year, monthIndex)
  };
}

function formatKrw(value: number): string {
  return `${value.toLocaleString('ko-KR')} KRW`;
}

export default function ReportsPage() {
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReportSummaryResponse | null>(null);
  const [transfers, setTransfers] = useState<TransferReportResponse | null>(null);
  const [cashflow, setCashflow] = useState<CashflowTrendResponse | null>(null);
  const [topExpense, setTopExpense] = useState<TopExpenseCategoriesResponse | null>(null);
  const [balances, setBalances] = useState<AccountBalanceTrendResponse | null>(null);
  const [error, setError] = useState('');

  const accountNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const account of accounts) map.set(account.id, account.name);
    return map;
  }, [accounts]);

  const applyRange = (range: { from: string; to: string }) => {
    setFrom(range.from);
    setTo(range.to);
  };

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const [accountRes, summaryRes, transferRes, cashflowRes, topExpenseRes, balanceRes] = await Promise.all([
          listAccounts(),
          getReportSummary({ from, to }),
          getTransferReport({ from, to }),
          getCashflowTrend({ from, to }),
          getTopExpenseCategories({ from, to, limit: 6 }),
          getAccountBalanceTrend({ from, to })
        ]);

        if (!active) return;
        setAccounts(accountRes.items);
        setSummary(summaryRes);
        setTransfers(transferRes);
        setCashflow(cashflowRes);
        setTopExpense(topExpenseRes);
        setBalances(balanceRes);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load reports.');
        setSummary(null);
        setTransfers(null);
        setCashflow(null);
        setTopExpense(null);
        setBalances(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [from, to]);

  const cashflowBars = useMemo(
    () => (cashflow?.items ?? []).map((item) => ({ label: item.date.slice(5), value: item.net })),
    [cashflow]
  );

  const balanceSeries = useMemo(
    () => (balances?.items ?? []).slice(0, 4).map((item, index) => ({
      label: item.accountName,
      color: ['#00e5ff', '#2f80ff', '#8fe9ff', '#7aa8ff'][index % 4],
      points: item.points.map((point) => ({ label: point.date.slice(5), value: point.balance }))
    })),
    [balances]
  );

  const topExpenseMax = useMemo(() => Math.max(...(topExpense?.items ?? []).map((item) => item.amount), 1), [topExpense]);

  return (
    <div className="page-container reports-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">Reporting</p>
          <h1 className="page-title">Trends & Balance</h1>
        </div>
      </div>

      <div className="card reports-filter-card">
        <div className="chip-group reports-range-preset">
          <span className="chip-group-label">Quick Range</span>
          <button className="chip" type="button" onClick={() => applyRange(currentMonthRange())}>This Month</button>
          <button className="chip" type="button" onClick={() => applyRange(lastMonthRange())}>Last Month</button>
        </div>
        <div className="grid-two">
          <label className="field">
            <span>From</span>
            <input aria-label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="field">
            <span>To</span>
            <input aria-label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
        <p className="hint">Inclusive range from <strong>{from}</strong> to <strong>{to}</strong>.</p>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <section className="reports-summary-grid">
        <article className="card reports-metric-card">
          <span className="page-kicker">Income</span>
          <strong className="kpi-positive">{loading || !summary ? '...' : formatKrw(summary.totalIncome)}</strong>
        </article>
        <article className="card reports-metric-card">
          <span className="page-kicker">Expense</span>
          <strong>{loading || !summary ? '...' : formatKrw(summary.totalExpense)}</strong>
        </article>
        <article className="card reports-metric-card">
          <span className="page-kicker">Net Saving</span>
          <strong className={(summary?.netSaving ?? 0) >= 0 ? 'kpi-positive' : 'kpi-negative'}>
            {loading || !summary ? '...' : formatKrw(summary.netSaving)}
          </strong>
        </article>
        <article className="card reports-metric-card">
          <span className="page-kicker">Transfer Volume</span>
          <strong>{loading || !summary ? '...' : formatKrw(summary.transferVolume)}</strong>
        </article>
      </section>

      <div className="reports-main-grid">
        <section className="card reports-chart-card">
          <div className="dashboard-panel-head">
            <div>
              <p className="page-kicker">Cashflow</p>
              <h3>Daily Net Rhythm</h3>
            </div>
          </div>
          <SparkBars items={cashflowBars} emptyLabel="No cashflow data in this range." />
        </section>

        <section className="card reports-top-expense-card">
          <div className="dashboard-panel-head">
            <div>
              <p className="page-kicker">Expense Mix</p>
              <h3>Top Categories</h3>
            </div>
          </div>
          {loading ? <p className="hint">Loading category spend...</p> : null}
          {!loading && (!topExpense || topExpense.items.length === 0) ? <p className="hint">No expense categories in this range.</p> : null}
          {!loading && topExpense && topExpense.items.length > 0 ? (
            <ul className="reports-top-expense-list">
              {topExpense.items.map((item) => (
                <li key={item.categoryName}>
                  <div className="reports-top-expense-head">
                    <strong>{item.categoryName}</strong>
                    <span>{formatKrw(item.amount)}</span>
                  </div>
                  <div className="reports-top-expense-bar">
                    <div style={{ width: `${Math.max(10, (item.amount / topExpenseMax) * 100)}%` }} />
                  </div>
                  <p className="hint">{item.transactionCount} item(s)</p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <section className="card reports-balance-card">
        <div className="dashboard-panel-head">
          <div>
            <p className="page-kicker">Balance Trend</p>
            <h3>Account Lanes</h3>
          </div>
        </div>
        <LineTrendChart series={balanceSeries} emptyLabel="No balance trend yet." />
      </section>

      <section className="card reports-transfer-card">
        <div className="dashboard-panel-head">
          <div>
            <p className="page-kicker">Transfer Matrix</p>
            <h3>Between Accounts</h3>
          </div>
        </div>

        {loading ? <p className="hint">Loading transfers...</p> : null}
        {!loading && transfers && transfers.items.length === 0 ? <p className="hint">No transfers found in this range.</p> : null}

        {!loading && transfers && transfers.items.length > 0 ? (
          <table className="flat-table">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transfers.items.map((item) => (
                <tr key={`${item.fromAccountId}-${item.toAccountId}`}>
                  <td>{accountNameById.get(item.fromAccountId) ?? `#${item.fromAccountId}`}</td>
                  <td>{accountNameById.get(item.toAccountId) ?? `#${item.toAccountId}`}</td>
                  <td>{formatKrw(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}
