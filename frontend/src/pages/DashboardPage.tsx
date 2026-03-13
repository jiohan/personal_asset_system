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
          <p className="page-kicker">아침 브리핑</p>
          <h1 className="page-title">컨트롤 센터</h1>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="dashboard-control-grid">
        <section className="card dashboard-hero-card">
          <div className="dashboard-hero-top">
            <div>
              <p className="page-kicker">이번 달</p>
              <h2>순 현금흐름</h2>
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
              <span>수입</span>
              <strong className="kpi-positive">{loading || !summary ? '...' : `${summary.totalIncome.toLocaleString('ko-KR')} KRW`}</strong>
            </article>
            <article className="dashboard-kpi">
              <span>지출</span>
              <strong>{loading || !summary ? '...' : `${summary.totalExpense.toLocaleString('ko-KR')} KRW`}</strong>
            </article>
            <article className="dashboard-kpi">
              <span>이체 합계</span>
              <strong>{loading || !summary ? '...' : `${summary.transferVolume.toLocaleString('ko-KR')} KRW`}</strong>
            </article>
            <article className="dashboard-kpi">
              <span>실시간 잔액</span>
              <strong>{loading ? '...' : `${currentBalanceTotal.toLocaleString('ko-KR')} KRW`}</strong>
            </article>
          </div>

          <div className="dashboard-trend-panel">
            <div className="dashboard-panel-head">
              <div>
                <h3>30일간의 리듬</h3>
                <p className="hint">양의 흐름일 때는 선명하게, 음의 흐름일 때는 차분하게 표시됩니다.</p>
              </div>
            </div>
            <SparkBars items={sparkItems} emptyLabel="아직 현금흐름 데이터가 없습니다." />
          </div>
        </section>

        <div className="dashboard-side-stack">
          <QuickEntryComposer
            accounts={accounts}
            categories={categories}
            title="빠른 입력"
            description="금액 -> 거래처 -> 계좌/카테고리 순으로 빠르게 입력하고 나중에 정리하세요."
            actionLabel="등록하기"
            onSaved={loadDashboard}
            suggestedCategoryIds={suggestedCategoryIds}
          />

          <section className="card dashboard-inbox-card">
            <div className="dashboard-panel-head">
              <div>
                <p className="page-kicker">인박스</p>
                <h3>검토 필요</h3>
              </div>
              <NavLink to="/transactions?tab=inbox" className="btn btn-primary">
                인박스 열기
              </NavLink>
            </div>

            {loading ? <p className="hint">항목을 불러오는 중...</p> : null}
            {!loading && inboxTransactions.length === 0 ? <p className="hint">인박스가 비어있습니다. 카테고리가 미지정된 내역이 여기에 표시됩니다.</p> : null}

            {!loading && inboxTransactions.length > 0 ? (
              <ul className="dashboard-inbox-list">
                {inboxTransactions.map((tx) => (
                  <li key={tx.id}>
                    <div>
                      <strong>{tx.description.trim() || '미지정 거래'}</strong>
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
              <p className="page-kicker">최근 기록</p>
              <h3>최신 거래 내역</h3>
            </div>
            <NavLink to="/transactions" className="btn">
              워크스페이스 열기
            </NavLink>
          </div>

          {loading ? <p className="hint">데이터를 불러오는 중...</p> : null}
          {!loading && recentTransactions.length === 0 ? <p className="hint">최근 거래 내역이 없습니다.</p> : null}

          {!loading && recentTransactions.length > 0 ? (
            <ul className="dashboard-inbox-list">
              {recentTransactions.map((tx) => {
                const categoryName = tx.categoryId ? (categoryNameById.get(tx.categoryId) ?? 'Unknown') : 'Inbox';
                const baseClass = tx.type === 'INCOME' ? 'income' : tx.type === 'EXPENSE' ? 'expense' : '';
                const sign = tx.type === 'TRANSFER' ? '↔' : tx.type === 'INCOME' ? '+' : '-';
                return (
                  <li key={tx.id}>
                    <div>
                      <strong>{tx.description.trim() || '미지정 거래'}</strong>
                      <p className="hint">
                        {tx.txDate} · {categoryName} · {transactionAccountLabel(tx, accountNameById)}
                      </p>
                    </div>
                    <span className={`dashboard-amount ${baseClass}`}>
                      {sign}
                      {tx.amount.toLocaleString('ko-KR')} KRW
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        <section className="card dashboard-balance-card">
          <div className="dashboard-panel-head">
            <div>
              <p className="page-kicker">계좌</p>
              <h3>활성 자산 현황</h3>
            </div>
            <NavLink to="/accounts" className="btn">
              계좌 관리
            </NavLink>
          </div>

          {loading ? <p className="hint">계좌 정보를 불러오는 중...</p> : null}
          {!loading && activeAccounts.length === 0 ? <p className="hint">계좌를 생성하여 자산 관리를 시작하세요.</p> : null}

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
