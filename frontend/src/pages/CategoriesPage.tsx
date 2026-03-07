import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createCategory, isApiError, listCategories, patchCategory, type CategoryResponse, type TransactionType } from '../api';

export default function CategoriesPage() {
    const [categories, setCategories] = useState<CategoryResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});
    const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});

    const [activeTab, setActiveTab] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
    const [categoryName, setCategoryName] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');

    const loadCategories = async () => {
        setLoading(true);
        try {
            const res = await listCategories();
            setCategories(res.items);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load categories.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let active = true;
        async function initLoad() {
            setLoading(true);
            try {
                const res = await listCategories();
                if (!active) return;
                setCategories(res.items);
            } catch (err: unknown) {
                if (!active) return;
                setError(err instanceof Error ? err.message : 'Failed to load categories.');
            } finally {
                if (active) setLoading(false);
            }
        }

        void initLoad();
        return () => { active = false; };
    }, []);

    const handleCreateCategory = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setCreateFieldErrors({});
        setSubmitting(true);
        try {
            await createCategory({ name: categoryName, type: activeTab, isActive: true });
            await loadCategories();
            setCategoryName('');
        } catch (err: unknown) {
            if (isApiError(err) && err.fieldErrors) {
                const next: Record<string, string> = {};
                for (const fe of err.fieldErrors) {
                    if (!next[fe.field]) next[fe.field] = fe.reason;
                }
                setCreateFieldErrors(next);
                setError(err.message);
            } else {
                setError(err instanceof Error ? err.message : 'Creation failed.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveEdit = async (id: number) => {
        setError('');
        setEditFieldErrors({});
        setSubmitting(true);
        try {
            await patchCategory(id, { name: editName });
            await loadCategories();
            setEditingId(null);
            setEditName('');
        } catch (err: unknown) {
            if (isApiError(err) && err.fieldErrors) {
                const next: Record<string, string> = {};
                for (const fe of err.fieldErrors) {
                    if (!next[fe.field]) next[fe.field] = fe.reason;
                }
                setEditFieldErrors(next);
                setError(err.message);
            } else {
                setError(err instanceof Error ? err.message : 'Update failed.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const startEdit = (cat: CategoryResponse) => {
        setEditingId(cat.id);
        setEditName(cat.name);
        setEditFieldErrors({});
    };

    const visibleCategories = useMemo(() => categories.filter(c => c.type === activeTab), [categories, activeTab]);

    return (
        <div className="page-container categories-page">
            <div className="page-header">
                <h1 className="page-title">Manage Categories</h1>
            </div>

            {error && <p className="error">{error}</p>}

            <div className="card categories-card">
                <div className="tabs inline-tabs">
                    <button
                        className={`tab ${activeTab === 'INCOME' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('INCOME')}
                    >
                        INCOME
                    </button>
                    <button
                        className={`tab ${activeTab === 'EXPENSE' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('EXPENSE')}
                    >
                        EXPENSE
                    </button>
                </div>

                <div className="pane-content">
                    <form className="inline-add-form" onSubmit={handleCreateCategory}>
                        <input
                            placeholder={`Add new ${activeTab.toLowerCase()} category...`}
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                            required
                            maxLength={100}
                        />
                        {createFieldErrors.name ? <span className="hint error">{createFieldErrors.name}</span> : null}
                        <button className="btn btn-primary" type="submit" disabled={submitting}>Add</button>
                    </form>

                    {loading ? (
                        <p>Loading...</p>
                    ) : (
                        <ul className="flat-list">
                            {visibleCategories.map(cat => (
                                <li key={cat.id} className="list-item">
                                    {editingId === cat.id ? (
                                        <form className="inline-edit-form fully-inline" onSubmit={(e) => { e.preventDefault(); void handleSaveEdit(cat.id); }}>
                                            <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} required maxLength={100} />
                                            {editFieldErrors.name ? <span className="hint error">{editFieldErrors.name}</span> : null}
                                            <button className="btn btn-primary btn-sm" type="submit" disabled={submitting}>💾</button>
                                            <button className="btn btn-sm" type="button" onClick={() => setEditingId(null)}>✕</button>
                                        </form>
                                    ) : (
                                        <>
                                            <span className="item-name">{cat.name}</span>
                                            <div className="item-actions">
                                                <button className="btn-icon" onClick={() => startEdit(cat)} disabled={submitting}>✎</button>
                                            </div>
                                        </>
                                    )}
                                </li>
                            ))}
                            {visibleCategories.length === 0 && <li className="hint list-item">No categories found for this type.</li>}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
