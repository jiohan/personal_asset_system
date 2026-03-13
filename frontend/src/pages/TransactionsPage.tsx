import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  createCategory,
  createTransaction,
  deleteTransaction,
  isApiError,
  listAccounts,
  listCategories,
  listTransactions,
  patchTransaction,
  type AccountResponse,
  type CategoryResponse,
  type TransactionResponse,
  type TransactionType
} from '../api';
import { useAuth } from '../context/AuthContext';
import CreatableCombobox, { type ComboboxOption } from '../components/CreatableCombobox';
import QuickEntryComposer from '../components/QuickEntryComposer';
import SummaryCards from '../components/SummaryCards';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayISO(): string {
  return isoLocalDate(new Date());
}

function monthStartISO(): string {
  const now = new Date();
  return isoLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function parseOptionalInteger(input: string, fieldName: string): number | undefined {
  const v = input.trim();
  if (v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`${fieldName} must be an integer.`);
  return n;
}

function parseOptionalIntegerParam(input: string | null): number | undefined {
  if (input == null) return undefined;
  const v = input.trim();
  if (v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return undefined;
  return n;
}

function parseOptionalStringParam(input: string | null): string | undefined {
  if (input == null) return undefined;
  const v = input.trim();
  return v === '' ? undefined : v;
}

function parseOptionalDateParam(input: string | null): string | undefined {
  const v = parseOptionalStringParam(input);
  if (!v) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  return v;
}

function parsePageParam(input: string | null): number {
  const n = parseOptionalIntegerParam(input);
  if (n == null || n < 0) return 0;
  return n;
}

function parsePositiveInteger(input: string, fieldName: string): number {
  const v = input.trim();
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) throw new Error(`${fieldName} must be a positive integer.`);
  return n;
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return isoLocalDate(d);
}

function formatGroupedDateLabel(isoDate: string): string {
  const today = todayISO();
  const yesterday = yesterdayISO();
  if (isoDate === today) return '오늘';
  if (isoDate === yesterday) return '어제';

  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;

  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return isoDate;
  return `${month}.${day}일`;
}

function cashflowDelta(tx: TransactionResponse): number {
  if (tx.type === 'INCOME') return tx.amount;
  if (tx.type === 'EXPENSE') return -tx.amount;
  return 0;
}

function formatSignedKrw(amount: number): string {
  if (amount === 0) return '0 KRW';
  const prefix = amount > 0 ? '+' : '-';
  return `${prefix}${Math.abs(amount).toLocaleString('ko-KR')} KRW`;
}

function formatKrw(amount: number): string {
  return `${Math.abs(amount).toLocaleString('ko-KR')} KRW`;
}

function accountTypeLabel(type: AccountResponse['type']): string {
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

type CategoryUsageType = 'INCOME' | 'EXPENSE';

type CategoryUsageStat = {
  categoryId: number;
  lastUsedAt: string;
  useCount: number;
};

type PendingDelete = {
  tx: TransactionResponse;
  executeAtMs: number;
  timerId: number;
};

function isCategoryUsageType(type: TransactionType): type is CategoryUsageType {
  return type === 'INCOME' || type === 'EXPENSE';
}

function usageStorageKey(userId: number, type: CategoryUsageType): string {
  return `ams.categoryUsage.v1.user.${userId}.type.${type}`;
}

function readCategoryUsageStats(userId: number, type: CategoryUsageType): CategoryUsageStat[] {
  try {
    const raw = localStorage.getItem(usageStorageKey(userId, type));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const result: CategoryUsageStat[] = [];
    for (const item of parsed) {
      if (
        typeof item === 'object'
        && item != null
        && Number.isInteger((item as { categoryId?: unknown }).categoryId)
        && typeof (item as { lastUsedAt?: unknown }).lastUsedAt === 'string'
        && Number.isInteger((item as { useCount?: unknown }).useCount)
      ) {
        result.push({
          categoryId: (item as { categoryId: number }).categoryId,
          lastUsedAt: (item as { lastUsedAt: string }).lastUsedAt,
          useCount: Math.max(1, (item as { useCount: number }).useCount)
        });
      }
    }
    return result;
  } catch {
    return [];
  }
}

function writeCategoryUsageStats(userId: number, type: CategoryUsageType, stats: CategoryUsageStat[]): void {
  localStorage.setItem(usageStorageKey(userId, type), JSON.stringify(stats));
}

function mergeCategoryUsageStats(base: CategoryUsageStat[], incoming: CategoryUsageStat[]): CategoryUsageStat[] {
  const map = new Map<number, CategoryUsageStat>();

  for (const item of base) {
    map.set(item.categoryId, { ...item });
  }

  for (const item of incoming) {
    const previous = map.get(item.categoryId);
    if (!previous) {
      map.set(item.categoryId, { ...item });
      continue;
    }

    map.set(item.categoryId, {
      categoryId: item.categoryId,
      useCount: Math.max(1, previous.useCount + item.useCount),
      lastUsedAt: previous.lastUsedAt > item.lastUsedAt ? previous.lastUsedAt : item.lastUsedAt
    });
  }

  return Array.from(map.values());
}

function deriveUsageFromTransactions(items: TransactionResponse[], type: CategoryUsageType): CategoryUsageStat[] {
  const map = new Map<number, CategoryUsageStat>();

  for (const tx of items) {
    if (tx.type !== type) continue;
    if (tx.categoryId == null) continue;

    const previous = map.get(tx.categoryId);
    if (!previous) {
      map.set(tx.categoryId, {
        categoryId: tx.categoryId,
        useCount: 1,
        lastUsedAt: tx.txDate
      });
      continue;
    }

    map.set(tx.categoryId, {
      categoryId: tx.categoryId,
      useCount: previous.useCount + 1,
      lastUsedAt: previous.lastUsedAt > tx.txDate ? previous.lastUsedAt : tx.txDate
    });
  }

  return Array.from(map.values());
}

function normalizeUsageStats(stats: CategoryUsageStat[]): CategoryUsageStat[] {
  return [...stats]
    .filter((s) => Number.isInteger(s.categoryId) && s.categoryId > 0)
    .sort((a, b) => {
      if (b.useCount !== a.useCount) return b.useCount - a.useCount;
      return b.lastUsedAt.localeCompare(a.lastUsedAt);
    })
    .slice(0, 100);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) return [];

  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;

      try {
        const value = await worker(items[current]);
        results[current] = { status: 'fulfilled', value };
      } catch (reason) {
        results[current] = { status: 'rejected', reason };
      }
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

export default function TransactionsPage() {
  const { me } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const inboxTab = searchParams.get('tab') === 'inbox';
  const urlType = searchParams.get('type');
  const filterType = (urlType === 'INCOME' || urlType === 'EXPENSE' || urlType === 'TRANSFER') ? (urlType as TransactionType) : '';
  const filterQuery = searchParams.get('q') ?? '';
  const filterAccountId = searchParams.get('accountId') ?? '';
  const filterCategoryId = searchParams.get('categoryId') ?? '';
  const filterFrom = searchParams.get('from') ?? '';
  const filterTo = searchParams.get('to') ?? '';
  const txPage = parsePageParam(searchParams.get('page'));
  const txSort = searchParams.get('sort') ?? 'txDate,desc';

  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bulkClearing, setBulkClearing] = useState(false);
  const [error, setError] = useState('');
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string>>({});
  const [bulkActionMessage, setBulkActionMessage] = useState('');

  const txSize = 50;
  const [txTotal, setTxTotal] = useState(0);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTxId, setEditingTxId] = useState<number | null>(null);

  const [txDate, setTxDate] = useState(todayISO());
  const [txType, setTxType] = useState<TransactionType>('EXPENSE');
  const [txAmount, setTxAmount] = useState('0');
  const [txAccountId, setTxAccountId] = useState('');
  const [txFromAccountId, setTxFromAccountId] = useState('');
  const [txToAccountId, setTxToAccountId] = useState('');
  const [txCategoryId, setTxCategoryId] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txNeedsReview, setTxNeedsReview] = useState(false);
  const [txExcludeFromReports, setTxExcludeFromReports] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(
    Boolean(filterCategoryId || filterQuery || filterFrom || filterTo || txSort !== 'txDate,desc')
  );

  const [selectedInboxIds, setSelectedInboxIds] = useState<Set<number>>(new Set());

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const pendingDeleteRef = useRef<PendingDelete | null>(null);
  const [hiddenDeletedIds, setHiddenDeletedIds] = useState<Set<number>>(new Set());
  const [pendingDeleteCountdownMs, setPendingDeleteCountdownMs] = useState(0);

  const [categoryUsage, setCategoryUsage] = useState<Record<CategoryUsageType, CategoryUsageStat[]>>({
    INCOME: [],
    EXPENSE: []
  });

  const selectAllInboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    pendingDeleteRef.current = pendingDelete;
  }, [pendingDelete]);

  useEffect(() => {
    if (!pendingDelete) {
      setPendingDeleteCountdownMs(0);
      return;
    }

    const tick = () => {
      setPendingDeleteCountdownMs(Math.max(0, pendingDelete.executeAtMs - Date.now()));
    };

    tick();
    const intervalId = window.setInterval(tick, 200);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [pendingDelete]);

  useEffect(() => {
    return () => {
      const current = pendingDeleteRef.current;
      if (!current) return;
      window.clearTimeout(current.timerId);
      void deleteTransaction(current.tx.id);
    };
  }, []);

  useEffect(() => {
    if (!me?.id) return;

    setCategoryUsage({
      INCOME: readCategoryUsageStats(me.id, 'INCOME'),
      EXPENSE: readCategoryUsageStats(me.id, 'EXPENSE')
    });
  }, [me?.id]);

  useEffect(() => {
    let active = true;
    Promise.all([listAccounts(), listCategories()]).then(([accRes, catRes]) => {
      if (!active) return;
      setAccounts(accRes.items);
      setCategories(catRes.items);
    }).catch((err) => {
      if (!active) return;
      console.error(err);
    });
    return () => {
      active = false;
    };
  }, []);

  const persistCategoryUsage = (type: CategoryUsageType, stats: CategoryUsageStat[]) => {
    if (!me?.id) return;
    writeCategoryUsageStats(me.id, type, stats);
  };

  const markCategoryUsed = (type: CategoryUsageType, categoryId: number) => {
    if (!me?.id) return;
    if (!Number.isInteger(categoryId) || categoryId <= 0) return;

    setCategoryUsage((prev) => {
      const existing = prev[type];
      const byCategory = new Map<number, CategoryUsageStat>();
      for (const item of existing) {
        byCategory.set(item.categoryId, { ...item });
      }

      const now = new Date().toISOString();
      const current = byCategory.get(categoryId);
      if (!current) {
        byCategory.set(categoryId, {
          categoryId,
          useCount: 1,
          lastUsedAt: now
        });
      } else {
        byCategory.set(categoryId, {
          categoryId,
          useCount: current.useCount + 1,
          lastUsedAt: now
        });
      }

      const normalized = normalizeUsageStats(Array.from(byCategory.values()));
      const next = {
        ...prev,
        [type]: normalized
      };
      persistCategoryUsage(type, normalized);
      return next;
    });
  };

  const syncUsageFromTransactions = (items: TransactionResponse[]) => {
    if (!me?.id) return;

    setCategoryUsage((prev) => {
      const derivedIncome = deriveUsageFromTransactions(items, 'INCOME');
      const derivedExpense = deriveUsageFromTransactions(items, 'EXPENSE');

      const mergedIncome = normalizeUsageStats(mergeCategoryUsageStats(prev.INCOME, derivedIncome));
      const mergedExpense = normalizeUsageStats(mergeCategoryUsageStats(prev.EXPENSE, derivedExpense));

      persistCategoryUsage('INCOME', mergedIncome);
      persistCategoryUsage('EXPENSE', mergedExpense);

      return {
        INCOME: mergedIncome,
        EXPENSE: mergedExpense
      };
    });
  };

  const refreshCategories = async () => {
    const res = await listCategories();
    setCategories((prev) => {
      const byId = new Map<number, CategoryResponse>();
      for (const c of res.items) byId.set(c.id, c);
      for (const c of prev) {
        if (!byId.has(c.id)) byId.set(c.id, c);
      }
      return Array.from(byId.values());
    });
  };

  const loadTransactions = async (page = txPage) => {
    setLoading(true);
    try {
      const res = await listTransactions({
        page,
        size: txSize,
        sort: txSort,
        from: parseOptionalDateParam(filterFrom),
        to: parseOptionalDateParam(filterTo),
        type: filterType || undefined,
        accountId: parseOptionalIntegerParam(searchParams.get('accountId')),
        categoryId: parseOptionalIntegerParam(searchParams.get('categoryId')),
        needsReview: inboxTab ? true : undefined,
        q: filterQuery.trim() ? filterQuery.trim() : undefined
      });
      setTransactions(res.items);
      setTxTotal(res.totalElements);
      syncUsageFromTransactions(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTransactions(txPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboxTab, filterType, filterQuery, filterAccountId, filterCategoryId, filterFrom, filterTo, txPage, txSort]);

  const updateSearchParam = (key: string, value: string | undefined, options?: { replace?: boolean; resetPage?: boolean }) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (options?.resetPage !== false) next.set('page', '0');
    setSearchParams(next, { replace: options?.replace });
  };

  const toggleInbox = (isInbox: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (isInbox) next.set('tab', 'inbox');
    else next.delete('tab');
    next.set('page', '0');
    setSearchParams(next);
  };

  const goToPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(Math.max(0, page)));
    setSearchParams(next);
  };

  const activeAccounts = useMemo(() => accounts.filter((a) => a.isActive), [accounts]);
  const selectableCategories = useMemo(() => categories.filter((c) => c.type === txType && c.isActive), [categories, txType]);
  const selectableFilterCategories = useMemo(() => categories.filter((c) => c.isActive), [categories]);

  const categoryOptions = useMemo<ComboboxOption[]>(
    () => selectableCategories.map((c) => ({ id: c.id, name: c.name })),
    [selectableCategories]
  );

  const usageForCurrentType = useMemo(() => {
    if (!isCategoryUsageType(txType)) return [];
    return categoryUsage[txType] ?? [];
  }, [categoryUsage, txType]);

  const selectableCategoryIdSet = useMemo(() => {
    const set = new Set<number>();
    for (const c of selectableCategories) set.add(c.id);
    return set;
  }, [selectableCategories]);

  const recentCategoryIds = useMemo(() => {
    if (!isCategoryUsageType(txType)) return [];
    return [...usageForCurrentType]
      .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
      .map((s) => s.categoryId)
      .filter((id) => selectableCategoryIdSet.has(id))
      .slice(0, 5);
  }, [txType, usageForCurrentType, selectableCategoryIdSet]);

  const frequentCategoryIds = useMemo(() => {
    if (!isCategoryUsageType(txType)) return [];
    return [...usageForCurrentType]
      .sort((a, b) => {
        if (b.useCount !== a.useCount) return b.useCount - a.useCount;
        return b.lastUsedAt.localeCompare(a.lastUsedAt);
      })
      .map((s) => s.categoryId)
      .filter((id) => selectableCategoryIdSet.has(id))
      .slice(0, 10);
  }, [txType, usageForCurrentType, selectableCategoryIdSet]);

  const quickEntryCategoryIds = useMemo(() => {
    return [...categoryUsage.EXPENSE, ...categoryUsage.INCOME]
      .sort((left, right) => {
        if (right.useCount !== left.useCount) return right.useCount - left.useCount;
        return right.lastUsedAt.localeCompare(left.lastUsedAt);
      })
      .map((item) => item.categoryId)
      .filter((value, index, array) => array.indexOf(value) === index)
      .slice(0, 8);
  }, [categoryUsage]);

  const visibleTransactions = useMemo(
    () => transactions.filter((tx) => !hiddenDeletedIds.has(tx.id)),
    [transactions, hiddenDeletedIds]
  );

  useEffect(() => {
    setSelectedInboxIds((prev) => {
      if (!inboxTab) {
        if (prev.size === 0) return prev;
        return new Set<number>();
      }

      const allowed = new Set(visibleTransactions.map((tx) => tx.id));
      let changed = false;
      const next = new Set<number>();

      for (const id of prev) {
        if (allowed.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }

      if (!changed && next.size === prev.size) return prev;
      return next;
    });
  }, [inboxTab, visibleTransactions]);

  const inboxRowIds = useMemo(() => (inboxTab ? visibleTransactions.map((tx) => tx.id) : []), [inboxTab, visibleTransactions]);
  const allInboxRowsSelected = inboxRowIds.length > 0 && inboxRowIds.every((id) => selectedInboxIds.has(id));
  const someInboxRowsSelected = inboxRowIds.some((id) => selectedInboxIds.has(id));

  useEffect(() => {
    if (!selectAllInboxRef.current) return;
    selectAllInboxRef.current.indeterminate = !allInboxRowsSelected && someInboxRowsSelected;
  }, [allInboxRowsSelected, someInboxRowsSelected]);

  const summaryFrom = parseOptionalDateParam(filterFrom) ?? monthStartISO();
  const summaryTo = parseOptionalDateParam(filterTo) ?? todayISO();

  const openNewDrawer = () => {
    setEditingTxId(null);
    setTxDate(todayISO());
    setTxAmount('0');
    setTxDescription('');
    setTxAccountId(activeAccounts.length > 0 ? String(activeAccounts[0].id) : '');
    setTxFromAccountId(activeAccounts.length > 0 ? String(activeAccounts[0].id) : '');
    setTxToAccountId(activeAccounts.length > 1 ? String(activeAccounts[1].id) : '');
    setTxCategoryId('');
    setTxNeedsReview(false);
    setTxExcludeFromReports(false);
    setShowMoreOptions(false);
    setFormFieldErrors({});
    setDrawerOpen(true);
  };

  const openEditDrawer = (tx: TransactionResponse) => {
    setEditingTxId(tx.id);
    setTxDate(tx.txDate);
    setTxType(tx.type);
    setTxAmount(String(tx.amount));
    setTxDescription(tx.description);

    if (tx.type === 'TRANSFER') {
      setTxAccountId('');
      setTxFromAccountId(tx.fromAccountId != null ? String(tx.fromAccountId) : '');
      setTxToAccountId(tx.toAccountId != null ? String(tx.toAccountId) : '');
      setTxCategoryId('');
      setTxNeedsReview(false);
      setTxExcludeFromReports(false);
      setShowMoreOptions(false);
    } else {
      setTxAccountId(tx.accountId != null ? String(tx.accountId) : '');
      setTxFromAccountId('');
      setTxToAccountId('');
      setTxCategoryId(tx.categoryId ? String(tx.categoryId) : '');
      setTxNeedsReview(tx.needsReview);
      setTxExcludeFromReports(tx.excludeFromReports);
      setShowMoreOptions(tx.needsReview || tx.excludeFromReports);
    }

    setFormFieldErrors({});
    setDrawerOpen(true);
  };

  useEffect(() => {
    if (!drawerOpen) return;
    if (editingTxId) return;
    if (txType !== 'TRANSFER') return;

    setTxCategoryId('');
    setTxNeedsReview(false);
    setTxExcludeFromReports(false);
    setShowMoreOptions(false);
  }, [txType, drawerOpen, editingTxId]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingTxId(null);
    setFormFieldErrors({});
  };

  useEffect(() => {
    if (!drawerOpen) return;
    if (editingTxId) return;

    if (txType === 'TRANSFER') {
      if (activeAccounts.length >= 2 && (txFromAccountId.trim() === '' || txToAccountId.trim() === '')) {
        setTxFromAccountId(String(activeAccounts[0].id));
        setTxToAccountId(String(activeAccounts[1].id));
      }
    } else if (activeAccounts.length >= 1 && txAccountId.trim() === '') {
      setTxAccountId(String(activeAccounts[0].id));
    }
  }, [drawerOpen, editingTxId, txType, activeAccounts, txAccountId, txFromAccountId, txToAccountId]);

  useEffect(() => {
    if (!drawerOpen) return;

    const v = txCategoryId.trim();
    if (!v) return;

    const id = Number(v);
    if (!Number.isFinite(id) || !Number.isInteger(id)) {
      setTxCategoryId('');
      return;
    }

    const selected = categories.find((c) => c.id === id);
    if (!selected || selected.type !== txType || !selected.isActive) {
      setTxCategoryId('');
    }
  }, [txType, categories, drawerOpen, txCategoryId]);

  const handleCreateCategory = async (rawName: string) => {
    setError('');
    setFormFieldErrors((prev) => {
      const next = { ...prev };
      delete next.categoryId;
      return next;
    });

    const name = rawName.trim();
    if (!name) {
      setFormFieldErrors((prev) => ({ ...prev, categoryId: 'must not be blank' }));
      return;
    }

    try {
      const created = await createCategory({ name, type: txType, isActive: true });
      setCategories((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]));
      setTxCategoryId(String(created.id));
      if (isCategoryUsageType(txType)) {
        markCategoryUsed(txType, created.id);
      }

      try {
        await refreshCategories();
      } catch (refreshErr) {
        console.error(refreshErr);
      }
    } catch (err: unknown) {
      if (isApiError(err) && err.fieldErrors) {
        setError(err.message);
        const hasNameError = err.fieldErrors.some((fe) => fe.field === 'name');
        if (hasNameError) {
          setFormFieldErrors((prev) => ({ ...prev, categoryId: 'invalid category name' }));
        }
      } else if (isApiError(err) && err.status === 409) {
        setError(err.message);
        setFormFieldErrors((prev) => ({ ...prev, categoryId: 'already exists' }));
      } else {
        setError(err instanceof Error ? err.message : 'Category creation failed.');
      }
    }
  };

  const handleCategorySelect = (nextValue: string) => {
    setTxCategoryId(nextValue);
    if (!isCategoryUsageType(txType)) return;

    const categoryId = Number(nextValue);
    if (!Number.isInteger(categoryId) || categoryId <= 0) return;

    markCategoryUsed(txType, categoryId);
  };

  const swapTransferAccounts = () => {
    setTxFromAccountId((currentFrom) => {
      const currentTo = txToAccountId;
      setTxToAccountId(currentFrom);
      return currentTo;
    });
  };

  const handleSaveTransaction = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setFormFieldErrors({});
    setSubmitting(true);

    try {
      const amount = parsePositiveInteger(txAmount, 'Amount');
      const categoryId = parseOptionalInteger(txCategoryId, 'Category');
      const categoryIsEmpty = txCategoryId.trim() === '';
      const normalizedNeedsReview = txType === 'TRANSFER' ? false : (categoryIsEmpty ? true : txNeedsReview);

      if (editingTxId) {
        const basePayload = {
          amount,
          description: txDescription,
          ...(txType === 'TRANSFER' ? {} : {
            clearCategory: categoryIsEmpty ? true : undefined,
            categoryId: categoryIsEmpty ? undefined : categoryId
          }),
          needsReview: normalizedNeedsReview,
          excludeFromReports: txType === 'EXPENSE' ? txExcludeFromReports : false
        };

        if (txType === 'TRANSFER') {
          const fromAccountId = parseOptionalInteger(txFromAccountId, 'From Account');
          const toAccountId = parseOptionalInteger(txToAccountId, 'To Account');
          if (fromAccountId == null || toAccountId == null) throw new Error('From and To accounts are required.');
          if (fromAccountId === toAccountId) throw new Error('From and To accounts must be different.');

          await patchTransaction(editingTxId, {
            ...basePayload,
            fromAccountId,
            toAccountId
          });
        } else {
          await patchTransaction(editingTxId, basePayload);
        }
      } else if (txType === 'TRANSFER') {
        const fromAccountId = parseOptionalInteger(txFromAccountId, 'From Account');
        const toAccountId = parseOptionalInteger(txToAccountId, 'To Account');
        if (fromAccountId == null || toAccountId == null) throw new Error('From and To accounts are required.');
        if (fromAccountId === toAccountId) throw new Error('From and To accounts must be different.');

        await createTransaction({
          txDate,
          type: 'TRANSFER',
          amount,
          fromAccountId,
          toAccountId,
          description: txDescription,
          needsReview: false,
          excludeFromReports: false
        });
      } else {
        const accountId = parseOptionalInteger(txAccountId, 'Account');
        if (accountId == null) throw new Error('Account is required.');

        await createTransaction({
          txDate,
          type: txType,
          amount,
          accountId,
          categoryId: categoryIsEmpty ? null : categoryId,
          description: txDescription,
          needsReview: normalizedNeedsReview,
          excludeFromReports: txType === 'EXPENSE' ? txExcludeFromReports : false
        });
      }

      await loadTransactions(txPage);
      closeDrawer();
    } catch (err: unknown) {
      if (isApiError(err) && err.fieldErrors) {
        const next: Record<string, string> = {};
        for (const fe of err.fieldErrors) {
          if (!next[fe.field]) next[fe.field] = fe.reason;
        }
        setFormFieldErrors(next);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Save failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const commitDeleteRequest = async (tx: TransactionResponse) => {
    try {
      await deleteTransaction(tx.id);
      setHiddenDeletedIds((prev) => {
        const next = new Set(prev);
        next.delete(tx.id);
        return next;
      });
      await loadTransactions(txPage);
    } catch (err: unknown) {
      setHiddenDeletedIds((prev) => {
        const next = new Set(prev);
        next.delete(tx.id);
        return next;
      });
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const commitPendingDelete = async (txId: number) => {
    const current = pendingDeleteRef.current;
    if (!current || current.tx.id !== txId) return;

    setPendingDelete(null);
    await commitDeleteRequest(current.tx);
  };

  const handleDelete = async (id: number) => {
    setError('');
    const tx = transactions.find((item) => item.id === id);
    if (!tx) return;

    const existing = pendingDeleteRef.current;
    if (existing && existing.tx.id !== id) {
      window.clearTimeout(existing.timerId);
      setPendingDelete(null);
      await commitDeleteRequest(existing.tx);
    } else if (existing && existing.tx.id === id) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void commitPendingDelete(id);
    }, 5000);

    setPendingDelete({
      tx,
      executeAtMs: Date.now() + 5000,
      timerId
    });

    setHiddenDeletedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    if (editingTxId === id) closeDrawer();
  };

  const handleUndoDelete = () => {
    const current = pendingDeleteRef.current;
    if (!current) return;

    window.clearTimeout(current.timerId);
    setPendingDelete(null);
    setHiddenDeletedIds((prev) => {
      const next = new Set(prev);
      next.delete(current.tx.id);
      return next;
    });
    closeDrawer();
  };

  const handleBulkSelectAll = (checked: boolean) => {
    if (!inboxTab) return;

    setSelectedInboxIds((prev) => {
      const next = new Set(prev);
      for (const id of inboxRowIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const handleBulkClear = async () => {
    if (!inboxTab) return;

    const ids = inboxRowIds.filter((id) => selectedInboxIds.has(id));
    if (ids.length === 0) return;

    setBulkClearing(true);
    setError('');
    setBulkActionMessage('');

    const results = await mapWithConcurrency(ids, 5, async (id) => {
      return patchTransaction(id, { needsReview: false });
    });

    const successIds = new Set<number>();
    const failedIds: number[] = [];

    results.forEach((result, index) => {
      const id = ids[index];
      if (result.status === 'fulfilled') {
        successIds.add(id);
      } else {
        failedIds.push(id);
      }
    });

    if (successIds.size > 0) {
      setTransactions((prev) => prev.map((tx) => (
        successIds.has(tx.id)
          ? { ...tx, needsReview: false }
          : tx
      )));
      setSelectedInboxIds((prev) => {
        const next = new Set(prev);
        for (const id of successIds) next.delete(id);
        return next;
      });
      setBulkActionMessage(`Cleared ${successIds.size} item(s).`);
    }

    if (failedIds.length > 0) {
      setError(`Failed to clear ${failedIds.length} item(s). Please retry.`);
    }

    await loadTransactions(txPage);
    setBulkClearing(false);
  };

  const txHasPrev = txPage > 0;
  const txHasNext = (txPage + 1) * txSize < txTotal;

  const categoryIsEmpty = txCategoryId.trim() === '';
  const effectiveNeedsReview = categoryIsEmpty ? true : txNeedsReview;

  const pendingCountdownSeconds = Math.max(0, Math.ceil(pendingDeleteCountdownMs / 1000));

  const accountById = useMemo(() => {
    const map = new Map<number, AccountResponse>();
    for (const account of accounts) map.set(account.id, account);
    return map;
  }, [accounts]);

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const category of categories) map.set(category.id, category.name);
    return map;
  }, [categories]);

  const groupedTransactions = useMemo(() => {
    const grouped = new Map<string, TransactionResponse[]>();

    for (const tx of visibleTransactions) {
      const bucket = grouped.get(tx.txDate);
      if (bucket) bucket.push(tx);
      else grouped.set(tx.txDate, [tx]);
    }

    return Array.from(grouped.entries()).map(([date, items]) => ({
      date,
      label: formatGroupedDateLabel(date),
      dayTotal: items.reduce((sum, tx) => sum + cashflowDelta(tx), 0),
      dayExpense: items.reduce((sum, tx) => sum + (tx.type === 'EXPENSE' ? tx.amount : 0), 0),
      dayIncome: items.reduce((sum, tx) => sum + (tx.type === 'INCOME' ? tx.amount : 0), 0),
      dayTransfer: items.reduce((sum, tx) => sum + (tx.type === 'TRANSFER' ? tx.amount : 0), 0),
      items
    }));
  }, [visibleTransactions]);

  return (
    <div className="page-container transactions-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">운영</p>
          <h1 className="page-title">거래 내역</h1>
        </div>
        <button className="btn btn-primary" onClick={openNewDrawer}>+ 새 거래 추가</button>
      </div>

      <SummaryCards from={summaryFrom} to={summaryTo} />

      <div className={`transactions-workspace ${drawerOpen ? 'detail-open' : ''}`}>
        <div className="transactions-master">
          <div className="card transactions-composer">
            <QuickEntryComposer
              accounts={accounts}
              categories={categories}
              title="간편 기입"
              description="매일 발생하는 거래를 빠르게 등록하세요. 상세 내용은 사이드 패널에서 편집할 수 있습니다."
              actionLabel="거래 등록"
              onSaved={() => loadTransactions(txPage)}
              onOpenFullForm={openNewDrawer}
              suggestedCategoryIds={quickEntryCategoryIds}
            />
          </div>

          <div className="filters-bar card transactions-filters">
            <div className="filter-chips">
              <div className="chip-group">
                <button className={`chip ${!inboxTab ? 'active' : ''}`} onClick={() => toggleInbox(false)}>전체</button>
                <button className={`chip ${inboxTab ? 'active' : ''}`} onClick={() => toggleInbox(true)}>인박스</button>
              </div>

              <div className="chip-group">
                <span className="chip-group-label">유형</span>
                <button className={`chip ${filterType === '' ? 'active' : ''}`} onClick={() => updateSearchParam('type', undefined)}>전체</button>
                <button className={`chip ${filterType === 'INCOME' ? 'active' : ''}`} onClick={() => updateSearchParam('type', 'INCOME')}>수입</button>
                <button className={`chip ${filterType === 'EXPENSE' ? 'active' : ''}`} onClick={() => updateSearchParam('type', 'EXPENSE')}>지출</button>
                <button className={`chip ${filterType === 'TRANSFER' ? 'active' : ''}`} onClick={() => updateSearchParam('type', 'TRANSFER')}>이체</button>
              </div>

              <div className="chip-group">
                <span className="chip-group-label">계좌</span>
                <button className={`chip ${filterAccountId === '' ? 'active' : ''}`} onClick={() => updateSearchParam('accountId', undefined)}>전체</button>
                {activeAccounts.map((a) => (
                  <button
                    key={a.id}
                    className={`chip ${filterAccountId === String(a.id) ? 'active' : ''}`}
                    onClick={() => updateSearchParam('accountId', String(a.id))}
                  >
                    {a.name}
                  </button>
                ))}
              </div>

              <button className="chip" onClick={() => setAdvancedFiltersOpen((v) => !v)}>
                {advancedFiltersOpen ? '필터 접기' : '상세 필터'}
              </button>
            </div>

            {advancedFiltersOpen && (
              <div className="filters-advanced">
                <label className="field-inline">
                  <span>카테고리</span>
                  <select value={filterCategoryId} onChange={(e) => updateSearchParam('categoryId', e.target.value || undefined)}>
                    <option value="">모든 카테고리</option>
                    {selectableFilterCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.type === 'INCOME' ? '수입' : '지출'})</option>
                    ))}
                  </select>
                </label>

                <label className="field-inline">
                  <span>검색</span>
                  <input
                    placeholder="내용 검색..."
                    value={filterQuery}
                    onChange={(e) => updateSearchParam('q', e.target.value || undefined, { replace: true })}
                  />
                </label>

                <label className="field-inline">
                  <span>시작일</span>
                  <input
                    type="date"
                    value={filterFrom}
                    onChange={(e) => updateSearchParam('from', e.target.value || undefined, { replace: true })}
                    aria-label="시작일"
                  />
                </label>

                <label className="field-inline">
                  <span>종료일</span>
                  <input
                    type="date"
                    value={filterTo}
                    onChange={(e) => updateSearchParam('to', e.target.value || undefined, { replace: true })}
                    aria-label="종료일"
                  />
                </label>

                <label className="field-inline">
                  <span>정렬</span>
                  <select value={txSort} onChange={(e) => updateSearchParam('sort', e.target.value || undefined)}>
                    <option value="txDate,desc">날짜 (최신순)</option>
                    <option value="txDate,asc">날짜 (오래된순)</option>
                    <option value="amount,desc">금액 (높은순)</option>
                    <option value="amount,asc">금액 (낮은순)</option>
                  </select>
                </label>
              </div>
            )}
          </div>


          {error ? <p className="error">{error}</p> : null}
          {bulkActionMessage ? <p className="hint">{bulkActionMessage}</p> : null}

          <div className="card table-container">
            {inboxTab && !loading && visibleTransactions.length > 0 && (
              <div className="inbox-bulk-bar">
                <label className="toggle-inline">
                  <input
                    ref={selectAllInboxRef}
                    type="checkbox"
                    checked={allInboxRowsSelected}
                    onChange={(e) => handleBulkSelectAll(e.target.checked)}
                  />
                  페이지 선택 ({selectedInboxIds.size}/{inboxRowIds.length})
                </label>
                <button
                  className="btn btn-sm"
                  type="button"
                  onClick={() => { void handleBulkClear(); }}
                  disabled={bulkClearing || selectedInboxIds.size === 0}
                >
                  {bulkClearing ? '정리 중...' : '검토 완료로 표시'}
                </button>
              </div>
            )}

            {loading ? <p>거래 내역을 불러오는 중...</p> : null}
            {!loading && visibleTransactions.length === 0 ? <p className="hint">조건에 맞는 거래 내역이 없습니다.</p> : null}

            {!loading && visibleTransactions.length > 0 && (
              <div className="transaction-group-list">
                {groupedTransactions.map((group) => (
                  <section key={group.date} className="tx-date-group">
                    <header className="tx-date-header">
                      <h3>{group.label}</h3>
                      <div className="tx-date-summary">
                        <p className={`tx-date-total ${group.dayTotal > 0 ? 'positive' : group.dayTotal < 0 ? 'negative' : 'neutral'}`}>
                          {formatSignedKrw(group.dayTotal)}
                        </p>
                        <p className="tx-date-subtotal">
                          <span className="expense">지출 -{formatKrw(group.dayExpense)}</span>
                          <span className="income">수입 +{formatKrw(group.dayIncome)}</span>
                          {group.dayTransfer > 0 ? <span className="transfer">이동 ↔{formatKrw(group.dayTransfer)}</span> : null}
                        </p>
                      </div>
                    </header>

                    <ul className="tx-items">
                      {group.items.map((tx) => {
                        const account = tx.accountId != null ? accountById.get(tx.accountId) : undefined;
                        const fromAccount = tx.fromAccountId != null ? accountById.get(tx.fromAccountId) : undefined;
                        const toAccount = tx.toAccountId != null ? accountById.get(tx.toAccountId) : undefined;

                        const categoryLabel = tx.type === 'TRANSFER'
                          ? '이체'
                          : (tx.categoryId != null ? (categoryNameById.get(tx.categoryId) ?? '미분류') : '미분류');

                        const accountLabel = tx.type === 'TRANSFER'
                          ? `${fromAccount?.name ?? '지원되지 않는 계좌'} -> ${toAccount?.name ?? '지원되지 않는 계좌'}`
                          : `${account?.name ?? '알 수 없는 계좌'}${account ? ` (${accountTypeLabel(account.type)})` : ''}`;

                        const displayTitle = tx.description.trim() !== ''
                          ? tx.description
                          : (tx.type === 'TRANSFER'
                            ? `${fromAccount?.name ?? '지원되지 않는 계좌'} -> ${toAccount?.name ?? '지원되지 않는 계좌'}`
                            : categoryLabel);

                        const amountText = tx.type === 'TRANSFER'
                          ? `↔${tx.amount.toLocaleString('ko-KR')} KRW`
                          : `${tx.type === 'INCOME' ? '+' : '-'}${tx.amount.toLocaleString('ko-KR')} KRW`;

                        return (
                          <li
                            key={tx.id}
                            onClick={() => openEditDrawer(tx)}
                            className={`tx-item clickable-row ${editingTxId === tx.id ? 'active-row' : ''}`}
                          >
                            {inboxTab ? (
                              <div
                                className="tx-item-select"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedInboxIds.has(tx.id)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSelectedInboxIds((prev) => {
                                      const next = new Set(prev);
                                      if (checked) next.add(tx.id);
                                      else next.delete(tx.id);
                                      return next;
                                    });
                                  }}
                                  aria-label={`Select transaction ${tx.id}`}
                                />
                              </div>
                            ) : null}

                            <div className="tx-item-main">
                              <div className="tx-item-top">
                                <div className="tx-item-title-line">
                                  <p className="tx-item-title">{displayTitle}</p>
                                  {tx.needsReview ? <span className="tx-review-badge">검토</span> : null}
                                </div>
                                <p className={`tx-item-amount ${tx.type.toLowerCase()}`}>
                                  {amountText}
                                </p>
                              </div>
                              <p className="tx-item-meta">{categoryLabel} · {accountLabel}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            <div className="pagination">
              <button className="btn" disabled={!txHasPrev} onClick={() => goToPage(txPage - 1)}>이전</button>
              <span>페이지 {txPage + 1}</span>
              <button className="btn" disabled={!txHasNext} onClick={() => goToPage(txPage + 1)}>다음</button>
            </div>
          </div>
        </div>

        <aside className={`transaction-detail-sheet ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>{editingTxId ? '내역 편집' : '새 거래 추가'}</h3>
              <button className="btn-icon" onClick={closeDrawer}>✕</button>
            </div>
            <div className="drawer-body">
              <form onSubmit={handleSaveTransaction}>
                <div className="form-group-type">
                  <button type="button" className={`btn-type ${txType === 'INCOME' ? 'active' : ''}`} onClick={() => setTxType('INCOME')} disabled={!!editingTxId}>
                    수입
                  </button>
                  <button type="button" className={`btn-type ${txType === 'EXPENSE' ? 'active' : ''}`} onClick={() => setTxType('EXPENSE')} disabled={!!editingTxId}>
                    지출
                  </button>
                  <button
                    type="button"
                    className={`btn-type ${txType === 'TRANSFER' ? 'active' : ''}`}
                    onClick={() => setTxType('TRANSFER')}
                    disabled={!!editingTxId || activeAccounts.length < 2}
                    title={activeAccounts.length < 2 ? '이체를 추가하려면 최소 두 개의 활성 계좌가 필요합니다.' : undefined}
                  >
                    이체
                  </button>
                </div>

                <label className="field">
                  <span>금액</span>
                  <input type="number" min="1" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} required aria-label="금액" />
                  {formFieldErrors.amount ? <span className="hint error">금액을 입력해주세요.</span> : null}
                </label>

                {txType !== 'TRANSFER' ? (
                  <label className="field">
                    <span>계좌</span>
                    <select value={txAccountId} onChange={(e) => setTxAccountId(e.target.value)} required disabled={!!editingTxId} aria-label="계좌">
                      <option value="">계좌 선택</option>
                      {(editingTxId ? accounts : activeAccounts).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    {activeAccounts.length === 0 && !editingTxId ? <span className="hint error">먼저 활성 계좌를 생성해야 합니다.</span> : null}
                    {formFieldErrors.accountId ? <span className="hint error">계좌를 선택해주세요.</span> : null}
                  </label>
                ) : (
                  <div className="transfer-inline">
                    <label className="field">
                      <span>출금 계좌</span>
                      <select aria-label="출금 계좌" value={txFromAccountId} onChange={(e) => setTxFromAccountId(e.target.value)} required>
                        <option value="">선택</option>
                        {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </label>

                    <button type="button" className="swap-btn" onClick={swapTransferAccounts} aria-label="계좌 전환">⇄</button>

                    <label className="field">
                      <span>입금 계좌</span>
                      <select aria-label="입금 계좌" value={txToAccountId} onChange={(e) => setTxToAccountId(e.target.value)} required>
                        <option value="">선택</option>
                        {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </label>
                  </div>
                )}

                {txType !== 'TRANSFER' ? (
                  <CreatableCombobox
                    label="카테고리"
                    value={txCategoryId}
                    options={categoryOptions}
                    recentIds={recentCategoryIds}
                    frequentIds={frequentCategoryIds}
                    onChange={handleCategorySelect}
                    onCreate={handleCreateCategory}
                    placeholder="카테고리 선택 또는 입력"
                    errorText={formFieldErrors.categoryId}
                  />
                ) : null}

                <label className="field">
                  <span>날짜</span>
                  <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} required disabled={!!editingTxId} aria-label="날짜" />
                </label>

                <label className="field">
                  <span>내용</span>
                  <input value={txDescription} onChange={(e) => setTxDescription(e.target.value)} aria-label="내용" />
                </label>

                {txType !== 'TRANSFER' ? (
                  <div className="more-options-wrap">
                    <button type="button" className="btn btn-sm" onClick={() => setShowMoreOptions((v) => !v)}>
                      {showMoreOptions ? '상세 옵션 숨기기' : '상세 옵션 표시'}
                    </button>

                    {showMoreOptions ? (
                      <div className="more-options-panel">
                        <label className="toggle-inline mt-2">
                          <input type="checkbox" checked={effectiveNeedsReview} onChange={(e) => setTxNeedsReview(e.target.checked)} disabled={categoryIsEmpty} aria-label="검토 필요" />
                          검토 필요
                        </label>

                        {categoryIsEmpty ? <p className="hint">카테고리가 없는 거래는 항상 <strong>검토 필요</strong> 상태로 저장됩니다.</p> : null}

                        {txType === 'EXPENSE' ? (
                          <label className="toggle-inline">
                            <input
                              type="checkbox"
                              checked={txExcludeFromReports}
                              onChange={(e) => setTxExcludeFromReports(e.target.checked)}
                              aria-label="보고서 제외"
                            />
                            보고서 제외
                          </label>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="drawer-footer">
                  <button
                    type="submit"
                    className="btn btn-primary full-width"
                    disabled={
                      submitting
                      || (!editingTxId && (txType === 'TRANSFER' ? activeAccounts.length < 2 : activeAccounts.length === 0))
                    }
                  >
                    {submitting ? '저장 중...' : '거래 내역 저장'}
                  </button>
                  {editingTxId ? (
                    <button
                      type="button"
                      className="btn btn-danger full-width mt-1"
                      onClick={() => { void handleDelete(editingTxId); }}
                      disabled={submitting}
                    >
                      삭제
                    </button>
                  ) : null}
                </div>
              </form>
            </div>
          </div>
        </aside>
      </div>

      {drawerOpen ? <button className="transaction-drawer-backdrop" onClick={closeDrawer} aria-label="Close side sheet" /> : null}

      {
        pendingDelete ? (
          <div className="tx-snackbar" role="status" aria-live="polite">
            <span>삭제되었습니다 · 실행 취소 ({pendingCountdownSeconds}초)</span>
            <button className="btn btn-sm" type="button" onClick={handleUndoDelete}>실행 취소</button>
          </div>
        ) : null
      }
    </div >
  );
}
