import { useEffect, useState, useMemo } from 'react';
import { listAccounts, listTransactions, type AccountResponse, type TransactionResponse } from '../api';
import { NavLink } from 'react-router-dom';

export default function DashboardPage() {
    const [accounts, setAccounts] = useState<AccountResponse[]>([]);
    const [rxLoading, setRxLoading] = useState(true);
    const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
    const [txLoading, setTxLoading] = useState(true);
    const [needsReviewCount, setNeedsReviewCount] = useState(0);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        async function loadData() {
            try {
                const [accRes, txsRes] = await Promise.all([
                    listAccounts(),
                    listTransactions({ page: 0, size: 10, sort: 'txDate,desc' }) // Just recent 10 for dashboard
                ]);

                if (!active) return;
                setAccounts(accRes.items);
                setTransactions(txsRes.items);
            } catch (err: unknown) {
                if (!active) return;
                setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
            } finally {
                if (active) {
                    setRxLoading(false);
                    setTxLoading(false);
                }
            }
        }

        async function loadInboxCount() {
            try {
                const inboxRes = await listTransactions({ page: 0, size: 1, needsReview: true });
                if (active) {
                    setNeedsReviewCount(inboxRes.totalElements);
                }
            } catch (error) {
                console.error("Failed to load inbox count", error);
            }
        }

        void loadData();
        void loadInboxCount();

        return () => { active = false; };
    }, []);

    const activeAccounts = useMemo(() => accounts.filter(a => a.isActive), [accounts]);

    // Calculate total balance across active accounts (just for display purposes, maybe not if strict about "no calculated totals")
    // The guide says: "Slice3 단계에서는 `/reports/*`가 없으므로, "기간 전체 합계"를 UI에서 보여주지 않는다.
    // 대시보드는 "최근 거래", "계좌 수", "활성 계좌 수", "인박스(needsReview)" 같은 안전한 범위의 지표 위주로 구성한다."
    // So we will just show active accounts count.

    return (
        <div className="page-container dashboard-page">
            <h1 className="page-title">DASHBOARD</h1>

            {error && <p className="error">{error}</p>}

            <div className="dashboard-grid">
                <div className="card summary-card">
                    <h3>{rxLoading ? '...' : activeAccounts.length} Active Accounts</h3>
                    <p className="hint">View details in <NavLink to="/accounts">Accounts</NavLink></p>
                </div>

                {needsReviewCount > 0 && (
                    <div className="card alert-card">
                        <h3>INBOX (NEEDS REVIEW)</h3>
                        <p>{needsReviewCount} items pending categorization. Review recent transactions.</p>
                        <NavLink to="/transactions?tab=inbox" className="btn btn-primary">REVIEW {needsReviewCount} ITEMS</NavLink>
                    </div>
                )}
            </div>

            <div className="card">
                <h3>Recent Transactions</h3>
                {txLoading ? <p>Loading recent transactions...</p> : null}
                {!txLoading && transactions.length === 0 ? <p className="hint">No recent transactions.</p> : null}

                {!txLoading && transactions.length > 0 && (
                    <table className="flat-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map(tx => (
                                <tr key={tx.id}>
                                    <td>{tx.txDate}</td>
                                    <td>{tx.description || '(no description)'} <span className="hint block">{tx.type}</span></td>
                                    <td className={tx.type === 'INCOME' ? 'text-cyan' : ''}>
                                        {tx.type === 'INCOME' ? '+' : '-'}{tx.amount.toLocaleString()} KRW
                                    </td>
                                    <td>
                                        {tx.needsReview ? (
                                            <span className="badge badge-alert">Review</span>
                                        ) : (
                                            <span className="badge badge-success">Cleared</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
