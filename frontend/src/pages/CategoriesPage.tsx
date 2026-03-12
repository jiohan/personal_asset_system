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
    throw new Error(`${fieldName} must be a non-negative integer.`);
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
        setError(err instanceof Error ? err.message : 'Failed to load categories.');
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
      const orderIndex = parseOptionalNonNegativeInteger(createOrderIndex, 'Order index');

      await createCategory({
        name: createName.trim(),
        type: activeTab,
        isActive: true,
        ...(orderIndex != null ? { orderIndex } : {})
      });

      await loadCategories();
      resetCreateFields();
      setSuccessMessage('Category row added.');
    } catch (err: unknown) {
      if (isApiError(err) && err.fieldErrors) {
        const nextErrors: Record<string, string> = {};
        for (const fieldError of err.fieldErrors) {
          if (!nextErrors[fieldError.field]) nextErrors[fieldError.field] = fieldError.reason;
        }
        setCreateFieldErrors(nextErrors);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Category creation failed.');
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
      const orderIndex = parseOptionalNonNegativeInteger(editRow.orderIndex, 'Order index');
      await patchCategory(categoryId, {
        name: editRow.name.trim(),
        ...(orderIndex != null ? { orderIndex } : {})
      });

      await loadCategories();
      setEditRow(null);
      setSuccessMessage('Category row updated.');
    } catch (err: unknown) {
      if (isApiError(err) && err.fieldErrors) {
        const nextErrors: Record<string, string> = {};
        for (const fieldError of err.fieldErrors) {
          if (!nextErrors[fieldError.field]) nextErrors[fieldError.field] = fieldError.reason;
        }
        setEditFieldErrors(nextErrors);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Category update failed.');
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
      setSuccessMessage('Category status updated.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Category update failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container categories-page management-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">Library</p>
          <h1 className="page-title">Category Library</h1>
        </div>
      </div>

      <div className="segmented-control utility-segmented-control" role="tablist" aria-label="Category lane">
        <button
          className={activeTab === 'EXPENSE' ? 'active' : ''}
          type="button"
          onClick={() => setActiveTab('EXPENSE')}
        >
          Expense
        </button>
        <button
          className={activeTab === 'INCOME' ? 'active' : ''}
          type="button"
          onClick={() => setActiveTab('INCOME')}
        >
          Income
        </button>
      </div>

      <section className="management-overview-grid">
        <article className="card management-metric-card">
          <span className="page-kicker">Visible Rows</span>
          <strong>{visibleCategories.length.toLocaleString('ko-KR')}</strong>
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
          <span className="page-kicker">Next Order Slot</span>
          <strong>{Math.max(0, nextOrderIndex).toLocaleString('ko-KR')}</strong>
        </article>
      </section>

      {error ? (
        <StateNotice tone="error" title="Could not update the category library." description={error} compact />
      ) : null}
      {successMessage ? (
        <StateNotice tone="success" title={successMessage} compact />
      ) : null}

      <div className="management-shell">
        <section className="card management-create-card">
          <div className="management-toolbar">
            <div>
              <p className="page-kicker">{activeTab === 'EXPENSE' ? 'Expense Lane' : 'Income Lane'}</p>
              <h3>Fast Add Row</h3>
            </div>
          </div>
          <form className="management-create-grid" onSubmit={handleCreateCategory}>
            <label className="field">
              <span>Category Name</span>
              <input
                aria-label="Category name"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                required
                maxLength={100}
              />
              {createFieldErrors.name ? <span className="hint error">{createFieldErrors.name}</span> : null}
            </label>
            <label className="field">
              <span>Order Index</span>
              <input
                aria-label="Category order index"
                inputMode="numeric"
                placeholder={String(Math.max(0, nextOrderIndex))}
                value={createOrderIndex}
                onChange={(event) => setCreateOrderIndex(event.target.value)}
              />
              {createFieldErrors.orderIndex ? <span className="hint error">{createFieldErrors.orderIndex}</span> : null}
            </label>
            <div className="management-form-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Category'}
              </button>
              <button className="btn" type="button" onClick={resetCreateFields}>
                Reset
              </button>
            </div>
          </form>

          <div className="management-type-strip">
            <article className="management-type-chip">
              <span>{activeTab === 'EXPENSE' ? 'Expense Lane' : 'Income Lane'}</span>
              <strong>{visibleCategories.length.toLocaleString('ko-KR')} row(s)</strong>
            </article>
            <article className="management-type-chip">
              <span>Archived Rows</span>
              <strong>{archivedCount.toLocaleString('ko-KR')}</strong>
            </article>
          </div>
        </section>

        <section className="card management-main-card">
          <div className="management-toolbar">
            <div>
              <p className="page-kicker">Dense View</p>
              <h3>Scan, rename, archive</h3>
            </div>
            <p className="management-section-note">Rows stay lane-specific so the transaction workspace can scan faster.</p>
          </div>

          {loading ? (
            <StateNotice
              tone="loading"
              title="Loading category library."
              description="Active and archived rows are being refreshed."
            />
          ) : null}

          {!loading && visibleCategories.length === 0 ? (
            <StateNotice
              tone="empty"
              title={`No ${activeTab.toLowerCase()} categories yet.`}
              description="Add a row on the left to make this lane usable in the ledger workspace."
            />
          ) : null}

          {!loading && visibleCategories.length > 0 ? (
            <div className="management-table-wrap">
              <table className="flat-table management-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Order</th>
                    <th>Parent</th>
                    <th>Actions</th>
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
                              <span className="sr-only">Edit name for {category.name}</span>
                              <input
                                className="management-inline-input"
                                aria-label={`Edit name for ${category.name}`}
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
                            {category.isActive ? 'Active' : 'Archived'}
                          </StatusBadge>
                        </td>
                        <td>
                          {isEditing ? (
                            <label className="management-inline-stack">
                              <span className="sr-only">Edit order for {category.name}</span>
                              <input
                                className="management-inline-input"
                                aria-label={`Edit order for ${category.name}`}
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
                            <span>{category.orderIndex == null ? 'Auto' : category.orderIndex}</span>
                          )}
                        </td>
                        <td>
                          <StatusBadge tone="neutral">
                            {category.parentId == null ? 'Root' : `#${category.parentId}`}
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
                                  aria-label={`Edit ${category.name}`}
                                  onClick={() => startEdit(category)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  disabled={submitting}
                                  aria-label={`${category.isActive ? 'Archive' : 'Restore'} ${category.name}`}
                                  onClick={() => {
                                    void handleToggleActive(category);
                                  }}
                                >
                                  {category.isActive ? 'Archive' : 'Restore'}
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
