import { useEffect, useState } from 'react';
import { getReportSummary, listTransactions, type ReportSummaryResponse } from '../api';

type SummaryCardsProps = {
  from: string;
  to: string;
};

function formatKrw(value: number): string {
  return `${value.toLocaleString('ko-KR')} KRW`;
}

export default function SummaryCards({ from, to }: SummaryCardsProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReportSummaryResponse | null>(null);
  const [inboxCount, setInboxCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [summaryRes, inboxRes] = await Promise.all([
          getReportSummary({ from, to }),
          listTransactions({ from, to, needsReview: true, page: 0, size: 1 })
        ]);
        if (!active) return;
        setSummary(summaryRes);
        setInboxCount(inboxRes.totalElements);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load summary metrics.');
        setSummary(null);
        setInboxCount(0);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [from, to]);

  return (
    <section className="summary-cards-wrap" aria-label="Transactions summary">
      <div className="summary-cards-head">
        <h2>Summary</h2>
        <p className="hint">Range: {from} to {to}</p>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="summary-cards-grid">
        <article className="summary-card-item">
          <p className="summary-title">Income</p>
          <strong className="summary-value text-cyan">{loading || !summary ? '...' : formatKrw(summary.totalIncome)}</strong>
        </article>
        <article className="summary-card-item">
          <p className="summary-title">Expense</p>
          <strong className="summary-value">{loading || !summary ? '...' : formatKrw(summary.totalExpense)}</strong>
        </article>
        <article className="summary-card-item">
          <p className="summary-title">Net Saving</p>
          <strong className="summary-value">{loading || !summary ? '...' : formatKrw(summary.netSaving)}</strong>
        </article>
        <article className="summary-card-item">
          <p className="summary-title">Transfer</p>
          <strong className="summary-value">{loading || !summary ? '...' : formatKrw(summary.transferVolume)}</strong>
        </article>
        <article className="summary-card-item">
          <p className="summary-title">Inbox Needs Review</p>
          <strong className="summary-value">{loading ? '...' : `${inboxCount.toLocaleString('ko-KR')} items`}</strong>
        </article>
      </div>
    </section>
  );
}
