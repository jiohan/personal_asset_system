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
    throw new Error(`${fieldName}은(는) 0 이상의 정수여야 합니다.`);
  }

  return parsed;
}

function parseNonNegativeInteger(input: string, fieldName: string): number {
  const parsed = parseOptionalNonNegativeInteger(input, fieldName);
  if (parsed == null) {
    throw new Error(`${fieldName}은(는) 필수 항목입니다.`);
  }
  return parsed;
}

function formatKrw(value: number): string {
  return `${value.toLocaleString('ko-KR')} KRW`;
}

function accountTypeLabel(type: AccountType): string {
  switch (type) {
    case 'CHECKING':
      return '입출금';
    case 'SAVINGS':
      return '예적금';
    case 'CASH':
      return '현금';
    case 'INVESTMENT':
      return '투자';
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
        setError(err instanceof Error ? err.message : '계좌 내역을 불러오는데 실패했습니다.');
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
      const openingBalance = parseNonNegativeInteger(createOpeningBalance, '기초 잔액');
      const orderIndex = parseOptionalNonNegativeInteger(createOrderIndex, '정렬 순서');

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
      setSuccessMessage('라이브러리에 계좌가 추가되었습니다.');
    } catch (err: unknown) {
      if (isApiError(err) && err.fieldErrors) {
        const nextErrors: Record<string, string> = {};
        for (const fieldError of err.fieldErrors) {
          if (!nextErrors[fieldError.field]) nextErrors[fieldError.field] = fieldError.reason;
        }
        setCreateFieldErrors(nextErrors);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : '계좌 생성에 실패했습니다.');
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
      setSuccessMessage('계좌 상태가 업데이트되었습니다.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '계좌 업데이트에 실패했습니다.');
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
      const orderIndex = parseOptionalNonNegativeInteger(editRow.orderIndex, '정렬 순서');
      await patchAccount(accountId, {
        name: editRow.name.trim(),
        ...(orderIndex != null ? { orderIndex } : {})
      });

      await loadAccounts();
      setEditRow(null);
      setSuccessMessage('계좌 정보가 수정되었습니다.');
    } catch (err: unknown) {
      if (isApiError(err) && err.fieldErrors) {
        const nextErrors: Record<string, string> = {};
        for (const fieldError of err.fieldErrors) {
          if (!nextErrors[fieldError.field]) nextErrors[fieldError.field] = fieldError.reason;
        }
        setEditFieldErrors(nextErrors);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : '계좌 수정에 실패했습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container accounts-page management-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">라이브러리</p>
          <h1 className="page-title">자산 계좌</h1>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setIsCreating((value) => !value)}>
          {isCreating ? '닫기' : '새 계좌 추가'}
        </button>
      </div>

      <section className="management-overview-grid">
        <article className="card management-metric-card">
          <span className="page-kicker">총 계좌 수</span>
          <strong>{accounts.length.toLocaleString('ko-KR')}개</strong>
        </article>
        <article className="card management-metric-card">
          <span className="page-kicker">활성</span>
          <strong>{activeCount.toLocaleString('ko-KR')}개</strong>
        </article>
        <article className="card management-metric-card">
          <span className="page-kicker">보관</span>
          <strong>{archivedCount.toLocaleString('ko-KR')}개</strong>
        </article>
        <article className="card management-metric-card accent">
          <span className="page-kicker">총 실시간 잔액</span>
          <strong>{formatKrw(liveBalanceTotal)}</strong>
        </article>
      </section>

      {error ? (
        <StateNotice tone="error" title="계좌 라이브러리를 업데이트할 수 없습니다." description={error} compact />
      ) : null}
      {successMessage ? (
        <StateNotice tone="success" title={successMessage} compact />
      ) : null}

      <div className="management-shell">
        {isCreating ? (
          <section className="card management-create-card">
            <div className="management-toolbar">
              <div>
                <p className="page-kicker">빠른 추가</p>
                <h3>새 계좌 정보</h3>
              </div>
            </div>
            <form className="management-create-grid" onSubmit={handleCreateAccount}>
              <label className="field">
                <span>계좌명</span>
                <input
                  aria-label="계좌명"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  required
                  maxLength={100}
                />
                {createFieldErrors.name ? <span className="hint error">{createFieldErrors.name}</span> : null}
              </label>
              <label className="field">
                <span>계좌 유형</span>
                <select
                  aria-label="계좌 유형"
                  value={createType}
                  onChange={(event) => setCreateType(event.target.value as AccountType)}
                >
                  <option value="CHECKING">입출금</option>
                  <option value="SAVINGS">예적금</option>
                  <option value="CASH">현금</option>
                  <option value="INVESTMENT">투자</option>
                </select>
              </label>
              <label className="field">
                <span>기초 잔액 (KRW)</span>
                <input
                  aria-label="기초 잔액 (KRW)"
                  inputMode="numeric"
                  value={createOpeningBalance}
                  onChange={(event) => setCreateOpeningBalance(event.target.value)}
                />
                {createFieldErrors.openingBalance ? <span className="hint error">{createFieldErrors.openingBalance}</span> : null}
              </label>
              <label className="field">
                <span>정렬 순서</span>
                <input
                  aria-label="정렬 순서"
                  inputMode="numeric"
                  placeholder="자동"
                  value={createOrderIndex}
                  onChange={(event) => setCreateOrderIndex(event.target.value)}
                />
                {createFieldErrors.orderIndex ? <span className="hint error">{createFieldErrors.orderIndex}</span> : null}
              </label>
              <div className="management-form-actions">
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? '생성 중...' : '계좌 생성'}
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    resetCreateForm();
                    setIsCreating(false);
                  }}
                >
                  취소
                </button>
              </div>
            </form>
          </section>
        ) : (
          <StateNotice
            tone="disabled"
            title="새 계좌 추가 영역이 닫혀 있습니다."
            description="다른 계좌를 등록하려면 새 항목 추가를 클릭하세요."
            action={(
              <button className="btn btn-primary" type="button" onClick={() => setIsCreating(true)}>
                항목 열기
              </button>
            )}
          />
        )}

        <section className="card management-main-card">
          <div className="management-toolbar">
            <div>
              <p className="page-kicker">상세 목록</p>
              <h3>조회, 이름 수정, 보관</h3>
            </div>
            <p className="management-section-note">활성 계좌가 위쪽에 표시되며, 정렬 순서를 통해 목록을 관리할 수 있습니다.</p>
          </div>

          {loading ? (
            <StateNotice
              tone="loading"
              title="계좌 라이브러리를 불러오는 중입니다."
              description="잔액과 활성화 상태를 업데이트하고 있습니다."
            />
          ) : null}

          {!loading && orderedAccounts.length === 0 ? (
            <StateNotice
              tone="empty"
              title="아직 등록된 계좌가 없습니다."
              description="거래 내역을 기록하기 위해 첫 번째 자산 계좌를 생성하세요."
              action={(
                <button className="btn btn-primary" type="button" onClick={() => setIsCreating(true)}>
                  첫 계좌 추가하기
                </button>
              )}
            />
          ) : null}

          {!loading && orderedAccounts.length > 0 ? (
            <div className="management-table-wrap">
              <table className="flat-table management-table">
                <thead>
                  <tr>
                    <th>계좌</th>
                    <th>유형</th>
                    <th>실시간 잔액</th>
                    <th>기초 잔액</th>
                    <th>상태</th>
                    <th>순서</th>
                    <th>관리</th>
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
                              <span className="sr-only">{account.name} 이름 수정</span>
                              <input
                                className="management-inline-input"
                                aria-label={`${account.name} 이름 수정`}
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
                            {account.isActive ? '활성' : '보관됨'}
                          </StatusBadge>
                        </td>
                        <td>
                          {isEditing ? (
                            <label className="management-inline-stack">
                              <span className="sr-only">{account.name} 순서 수정</span>
                              <input
                                className="management-inline-input"
                                aria-label={`${account.name} 순서 수정`}
                                inputMode="numeric"
                                placeholder="자동"
                                value={editRow.orderIndex}
                                onChange={(event) => setEditRow((current) => (
                                  current ? { ...current, orderIndex: event.target.value } : current
                                ))}
                              />
                              {editFieldErrors.orderIndex ? <span className="hint error">{editFieldErrors.orderIndex}</span> : null}
                            </label>
                          ) : (
                            <span>{account.orderIndex == null ? '자동' : account.orderIndex}</span>
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
                                  저장
                                </button>
                                <button className="btn btn-sm" type="button" onClick={() => setEditRow(null)}>
                                  취소
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  disabled={submitting}
                                  aria-label={`${account.name} 수정`}
                                  onClick={() => startEdit(account)}
                                >
                                  수정
                                </button>
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  disabled={submitting}
                                  aria-label={`${account.isActive ? '보관' : '복구'} ${account.name}`}
                                  onClick={() => {
                                    void handleToggleActive(account);
                                  }}
                                >
                                  {account.isActive ? '보관' : '복구'}
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
