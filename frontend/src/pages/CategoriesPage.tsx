import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createCategory,
  isApiError,
  listCategories,
  patchCategory,
  type CategoryResponse
} from '../api';
import StateNotice from '../components/StateNotice';
import StatusBadge from '../components/StatusBadge';

type CategoryLane = 'INCOME' | 'EXPENSE';

type EditableCategory = {
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

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [activeTab, setActiveTab] = useState<CategoryLane>('EXPENSE');
  const [createName, setCreateName] = useState('');
  const [createOrderIndex, setCreateOrderIndex] = useState('');
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});

  const [editRow, setEditRow] = useState<EditableCategory | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});

  const loadCategories = async () => {
    const response = await listCategories();
    setCategories(response.items);
  };

  useEffect(() => {
    let active = true;

    async function initLoad() {
      setLoading(true);
      setError('');
      try {
        const response = await listCategories();
        if (!active) return;
        setCategories(response.items);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : '카테고리 내역을 불러오는데 실패했습니다.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void initLoad();
    return () => {
      active = false;
    };
  }, []);

  const visibleCategories = useMemo(
    () => [...categories]
      .filter((category) => category.type === activeTab)
      .sort((left, right) => {
        if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;

        const leftOrder = left.orderIndex ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.orderIndex ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;

        return left.name.localeCompare(right.name);
      }),
    [categories, activeTab]
  );

  const activeCount = useMemo(
    () => visibleCategories.filter((category) => category.isActive).length,
    [visibleCategories]
  );
  const archivedCount = visibleCategories.length - activeCount;
  const nextOrderIndex = useMemo(
    () => visibleCategories.reduce((max, category) => Math.max(max, category.orderIndex ?? -1), -1) + 1,
    [visibleCategories]
  );

  const resetCreateFields = () => {
    setCreateName('');
    setCreateOrderIndex('');
    setCreateFieldErrors({});
  };

  const handleCreateCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setCreateFieldErrors({});
    setSubmitting(true);

    try {
      const orderIndex = parseOptionalNonNegativeInteger(createOrderIndex, '정렬 순서');

      await createCategory({
        name: createName.trim(),
        type: activeTab,
        isActive: true,
        ...(orderIndex != null ? { orderIndex } : {})
      });

      await loadCategories();
      resetCreateFields();
      setSuccessMessage('카테고리가 추가되었습니다.');
    } catch (err: unknown) {
      if (isApiError(err) && err.fieldErrors) {
        const nextErrors: Record<string, string> = {};
        for (const fieldError of err.fieldErrors) {
          if (!nextErrors[fieldError.field]) nextErrors[fieldError.field] = fieldError.reason;
        }
        setCreateFieldErrors(nextErrors);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : '카테고리 생성에 실패했습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (category: CategoryResponse) => {
    setEditFieldErrors({});
    setEditRow({
      id: category.id,
      name: category.name,
      orderIndex: category.orderIndex == null ? '' : String(category.orderIndex)
    });
  };

  const handleSaveEdit = async (categoryId: number) => {
    if (!editRow || editRow.id !== categoryId) return;

    setError('');
    setSuccessMessage('');
    setEditFieldErrors({});
    setSubmitting(true);

    try {
      const orderIndex = parseOptionalNonNegativeInteger(editRow.orderIndex, '정렬 순서');
      await patchCategory(categoryId, {
        name: editRow.name.trim(),
        ...(orderIndex != null ? { orderIndex } : {})
      });

      await loadCategories();
      setEditRow(null);
      setSuccessMessage('카테고리 정보가 수정되었습니다.');
    } catch (err: unknown) {
      if (isApiError(err) && err.fieldErrors) {
        const nextErrors: Record<string, string> = {};
        for (const fieldError of err.fieldErrors) {
          if (!nextErrors[fieldError.field]) nextErrors[fieldError.field] = fieldError.reason;
        }
        setEditFieldErrors(nextErrors);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : '카테고리 수정에 실패했습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (category: CategoryResponse) => {
    setError('');
    setSuccessMessage('');
    setSubmitting(true);

    try {
      await patchCategory(category.id, { isActive: !category.isActive });
      await loadCategories();
      setSuccessMessage('카테고리 상태가 업데이트되었습니다.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '카테고리 업데이트에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container categories-page management-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">라이브러리</p>
          <h1 className="page-title">카테고리 관리</h1>
        </div>
      </div>

      <div className="segmented-control utility-segmented-control" role="tablist" aria-label="Category lane">
        <button
          className={activeTab === 'EXPENSE' ? 'active' : ''}
          type="button"
          onClick={() => setActiveTab('EXPENSE')}
        >
          지출
        </button>
        <button
          className={activeTab === 'INCOME' ? 'active' : ''}
          type="button"
          onClick={() => setActiveTab('INCOME')}
        >
          수입
        </button>
      </div>

      <section className="management-overview-grid">
        <article className="card management-metric-card">
          <span className="page-kicker">표시된 항목</span>
          <strong>{visibleCategories.length.toLocaleString('ko-KR')}개</strong>
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
          <span className="page-kicker">다음 정렬 순서</span>
          <strong>{Math.max(0, nextOrderIndex).toLocaleString('ko-KR')}</strong>
        </article>
      </section>

      {error ? (
        <StateNotice tone="error" title="카테고리 라이브러리를 업데이트할 수 없습니다." description={error} compact />
      ) : null}
      {successMessage ? (
        <StateNotice tone="success" title={successMessage} compact />
      ) : null}

      <div className="management-shell">
        <section className="card management-create-card">
          <div className="management-toolbar">
            <div>
              <p className="page-kicker">{activeTab === 'EXPENSE' ? '지출 카테고리' : '수입 카테고리'}</p>
              <h3>항목 빠른 추가</h3>
            </div>
          </div>
          <form className="management-create-grid" onSubmit={handleCreateCategory}>
            <label className="field">
              <span>카테고리명</span>
              <input
                aria-label="카테고리명"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                required
                maxLength={100}
              />
              {createFieldErrors.name ? <span className="hint error">{createFieldErrors.name}</span> : null}
            </label>
            <label className="field">
              <span>정렬 순서</span>
              <input
                aria-label="카테고리 정렬 순서"
                inputMode="numeric"
                placeholder={String(Math.max(0, nextOrderIndex))}
                value={createOrderIndex}
                onChange={(event) => setCreateOrderIndex(event.target.value)}
              />
              {createFieldErrors.orderIndex ? <span className="hint error">{createFieldErrors.orderIndex}</span> : null}
            </label>
            <div className="management-form-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? '생성 중...' : '카테고리 생성'}
              </button>
              <button className="btn" type="button" onClick={resetCreateFields}>
                초기화
              </button>
            </div>
          </form>

          <div className="management-type-strip">
            <article className="management-type-chip">
              <span>{activeTab === 'EXPENSE' ? '지출 카테고리' : '수입 카테고리'}</span>
              <strong>{visibleCategories.length.toLocaleString('ko-KR')}개 항목</strong>
            </article>
            <article className="management-type-chip">
              <span>보관된 항목</span>
              <strong>{archivedCount.toLocaleString('ko-KR')}개</strong>
            </article>
          </div>
        </section>

        <section className="card management-main-card">
          <div className="management-toolbar">
            <div>
              <p className="page-kicker">상세 목록</p>
              <h3>조회, 이름 수정, 보관</h3>
            </div>
            <p className="management-section-note">수입/지출별로 카테고리가 구분되어 있어 거래 내역 입력 시 더 빠르게 찾을 수 있습니다.</p>
          </div>

          {loading ? (
            <StateNotice
              tone="loading"
              title="카테고리 라이브러리를 불러오는 중입니다."
              description="활성 및 보관된 항목들을 업데이트하고 있습니다."
            />
          ) : null}

          {!loading && visibleCategories.length === 0 ? (
            <StateNotice
              tone="empty"
              title={`아직 등록된 ${activeTab === 'EXPENSE' ? '지출' : '수입'} 카테고리가 없습니다.`}
              description="왼쪽에서 새로운 항목을 추가하여 장부에서 사용할 수 있게 만드세요."
            />
          ) : null}

          {!loading && visibleCategories.length > 0 ? (
            <div className="management-table-wrap">
              <table className="flat-table management-table">
                <thead>
                  <tr>
                    <th>카테고리</th>
                    <th>상태</th>
                    <th>순서</th>
                    <th>상위</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCategories.map((category) => {
                    const isEditing = editRow?.id === category.id;
                    return (
                      <tr key={category.id} className={!category.isActive ? 'management-row-archived' : undefined}>
                        <td>
                          {isEditing ? (
                            <label className="management-inline-stack">
                              <span className="sr-only">{category.name} 이름 수정</span>
                              <input
                                className="management-inline-input"
                                aria-label={`${category.name} 이름 수정`}
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
                              <strong>{category.name}</strong>
                            </div>
                          )}
                        </td>
                        <td>
                          <StatusBadge tone={category.isActive ? 'success' : 'warning'}>
                            {category.isActive ? '활성' : '보관됨'}
                          </StatusBadge>
                        </td>
                        <td>
                          {isEditing ? (
                            <label className="management-inline-stack">
                              <span className="sr-only">{category.name} 순서 수정</span>
                              <input
                                className="management-inline-input"
                                aria-label={`${category.name} 순서 수정`}
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
                            <span>{category.orderIndex == null ? '자동' : category.orderIndex}</span>
                          )}
                        </td>
                        <td>
                          <StatusBadge tone="neutral">
                            {category.parentId == null ? '최상위' : `#${category.parentId}`}
                          </StatusBadge>
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
                                    void handleSaveEdit(category.id);
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
                                  aria-label={`${category.name} 수정`}
                                  onClick={() => startEdit(category)}
                                >
                                  수정
                                </button>
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  disabled={submitting}
                                  aria-label={`${category.isActive ? '보관' : '복구'} ${category.name}`}
                                  onClick={() => {
                                    void handleToggleActive(category);
                                  }}
                                >
                                  {category.isActive ? '보관' : '복구'}
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
