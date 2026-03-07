import { useEffect, useMemo, useState } from 'react';
import { getReportSummary, getTransferReport, listAccounts, type AccountResponse, type ReportSummaryResponse, type TransferReportResponse } from '../api';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function isoLocalDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthStartISO() {
  const now = new Date();
  return isoLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function todayISO() {
  return isoLocalDate(new Date());
}

export default function ReportsPage() {
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReportSummaryResponse | null>(null);
  const [transfers, setTransfers] = useState<TransferReportResponse | null>(null);
  const [error, setError] = useState('');

  const accountNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of accounts) map.set(a.id, a.name);
    return map;
  }, [accounts]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [accRes, summaryRes, transferRes] = await Promise.all([
          listAccounts(),
          getReportSummary({ from, to }),
          getTransferReport({ from, to })
        ]);
        if (!active) return;
        setAccounts(accRes.items);
        setSummary(summaryRes);
        setTransfers(transferRes);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load reports.');
        setSummary(null);
        setTransfers(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [from, to]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">REPORTS</h1>
      </div>

      <div className="card">
        <div className="grid-two">
          <label className="field">
            <span>From</span>
            <input aria-label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>To</span>
            <input aria-label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <p className="hint">Reports include transactions with txDate between <strong>{from}</strong> and <strong>{to}</strong> (inclusive).</p>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="dashboard-grid">
        <div className="card">
          <h3>Total Income</h3>
          <p className="hint">{loading || !summary ? '...' : `${summary.totalIncome.toLocaleString('ko-KR')} KRW`}</p>
        </div>
        <div className="card">
          <h3>Total Expense</h3>
          <p className="hint">{loading || !summary ? '...' : `${summary.totalExpense.toLocaleString('ko-KR')} KRW`}</p>
        </div>
        <div className="card">
          <h3>Net Saving</h3>
          <p className="hint">{loading || !summary ? '...' : `${summary.netSaving.toLocaleString('ko-KR')} KRW`}</p>
        </div>
        <div className="card">
          <h3>Transfer Volume</h3>
          <p className="hint">{loading || !summary ? '...' : `${summary.transferVolume.toLocaleString('ko-KR')} KRW`}</p>
        </div>
      </div>

      <div className="card">
        <h3>Transfers (Grouped by Account Pair)</h3>
        {loading ? <p>Loading transfer report...</p> : null}
        {!loading && transfers && transfers.items.length === 0 ? <p className="hint">No transfers found in this range.</p> : null}

        {!loading && transfers && transfers.items.length > 0 && (
          <table className="flat-table">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transfers.items.map((it) => (
                <tr key={`${it.fromAccountId}-${it.toAccountId}`}
                >
                  <td>{accountNameById.get(it.fromAccountId) ?? `#${it.fromAccountId}`}</td>
                  <td>{accountNameById.get(it.toAccountId) ?? `#${it.toAccountId}`}</td>
                  <td>{it.amount.toLocaleString('ko-KR')} KRW</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
