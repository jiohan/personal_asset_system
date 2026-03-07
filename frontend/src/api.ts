export type ApiFieldError = { field: string; reason: string };

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    fieldErrors?: ApiFieldError[] | null;
  };
};

export class ApiError extends Error {
  status: number;
  code?: string;
  fieldErrors?: ApiFieldError[];

  constructor(args: { status: number; message: string; code?: string; fieldErrors?: ApiFieldError[] }) {
    super(args.message);
    this.name = 'ApiError';
    this.status = args.status;
    this.code = args.code;
    this.fieldErrors = args.fieldErrors;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export type AuthMeResponse = {
  id: number;
  email: string;
};

export type AuthLoginRequest = {
  email: string;
  password: string;
};

export type AuthSignupRequest = {
  email: string;
  password: string;
};

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CASH' | 'INVESTMENT';
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type SourceType = 'MANUAL' | 'CSV';

export type AccountResponse = {
  id: number;
  name: string;
  type: AccountType;
  isActive: boolean;
  orderIndex: number | null;
  openingBalance: number;
  currentBalance?: number | null;
};

export type AccountListResponse = {
  items: AccountResponse[];
};

export type AccountCreateRequest = {
  name: string;
  type: AccountType;
  isActive?: boolean;
  orderIndex?: number;
  openingBalance?: number;
};

export type AccountPatchRequest = {
  name?: string;
  isActive?: boolean;
  orderIndex?: number;
};

export type TransactionResponse = {
  id: number;
  txDate: string;
  type: TransactionType;
  amount: number;
  accountId?: number | null;
  fromAccountId?: number | null;
  toAccountId?: number | null;
  description: string;
  categoryId?: number | null;
  tagNames: string[];
  needsReview: boolean;
  excludeFromReports: boolean;
  source: SourceType;
  deletedAt?: string | null;
};

export type PagedTransactionResponse = {
  items: TransactionResponse[];
  page: number;
  size: number;
  totalElements: number;
};

export type TransactionCreateRequest = {
  txDate: string;
  type: TransactionType;
  amount: number;
  accountId?: number;
  fromAccountId?: number;
  toAccountId?: number;
  description?: string;
  categoryId?: number | null;
  tagNames?: string[];
  needsReview?: boolean;
  excludeFromReports?: boolean;
};

export type TransactionPatchRequest = {
  txDate?: string;
  amount?: number;
  accountId?: number;
  fromAccountId?: number;
  toAccountId?: number;
  description?: string;
  categoryId?: number | null;
  clearCategory?: boolean;
  tagNames?: string[];
  needsReview?: boolean;
  excludeFromReports?: boolean;
};

export type CategoryResponse = {
  id: number;
  type: TransactionType;
  name: string;
  parentId?: number | null;
  isActive: boolean;
  orderIndex?: number | null;
};

export type CategoryListResponse = {
  items: CategoryResponse[];
};

export type CategoryCreateRequest = {
  type: TransactionType;
  name: string;
  parentId?: number;
  isActive?: boolean;
  orderIndex?: number;
};

export type CategoryPatchRequest = {
  name?: string;
  parentId?: number;
  isActive?: boolean;
  orderIndex?: number;
};

function getCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  for (const part of document.cookie.split(';')) {
    const s = part.trim();
    if (s.startsWith(prefix)) return decodeURIComponent(s.slice(prefix.length));
  }
  return null;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `/api/v1${path}`;
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);

  if (method !== 'GET' && method !== 'HEAD') {
    const token = getCookie('XSRF-TOKEN');
    if (token) headers.set('X-XSRF-TOKEN', token);
  }

  return fetch(url, {
    ...init,
    credentials: 'include',
    headers
  });
}

async function ensureXsrfCookie(): Promise<void> {
  // Slice1 hardening: backend requires XSRF cookie + X-XSRF-TOKEN header for POST endpoints.
  if (getCookie('XSRF-TOKEN')) return;
  await apiFetch('/auth/csrf');
}

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function requireOkJson<T>(res: Response): Promise<T> {
  if (res.ok) return readJson<T>(res);

  let message = `Request failed (${res.status}).`;
  let code: string | undefined;
  let fieldErrors: ApiFieldError[] | undefined;
  try {
    const body = await readJson<ApiErrorResponse>(res);
    message = body.error?.message ?? message;
    code = body.error?.code;
    if (body.error?.fieldErrors && Array.isArray(body.error.fieldErrors)) {
      fieldErrors = body.error.fieldErrors;
    }
  } catch {
    message = `Request failed (${res.status}).`;
  }

  throw new ApiError({ status: res.status, message, code, fieldErrors });
}

export async function getMe(): Promise<AuthMeResponse | null> {
  const res = await apiFetch('/auth/me');
  if (res.status === 401) return null;
  return requireOkJson<AuthMeResponse>(res);
}

export async function signup(req: AuthSignupRequest): Promise<AuthMeResponse> {
  await ensureXsrfCookie();
  const res = await apiFetch('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  return requireOkJson<AuthMeResponse>(res);
}

export async function login(req: AuthLoginRequest): Promise<AuthMeResponse> {
  await ensureXsrfCookie();
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  return requireOkJson<AuthMeResponse>(res);
}

export async function logout(): Promise<void> {
  await ensureXsrfCookie();
  const res = await apiFetch('/auth/logout', { method: 'POST' });
  if (res.status === 204) return;
  await requireOkJson<unknown>(res);
}

export async function listAccounts(): Promise<AccountListResponse> {
  const res = await apiFetch('/accounts');
  return requireOkJson<AccountListResponse>(res);
}

export async function createAccount(req: AccountCreateRequest): Promise<AccountResponse> {
  await ensureXsrfCookie();
  const res = await apiFetch('/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  return requireOkJson<AccountResponse>(res);
}

export async function patchAccount(id: number, req: AccountPatchRequest): Promise<AccountResponse> {
  await ensureXsrfCookie();
  const res = await apiFetch(`/accounts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  return requireOkJson<AccountResponse>(res);
}

export async function listTransactions(params: {
  from?: string;
  to?: string;
  accountId?: number;
  type?: TransactionType;
  categoryId?: number;
  needsReview?: boolean;
  q?: string;
  page?: number;
  size?: number;
  sort?: string;
} = {}): Promise<PagedTransactionResponse> {
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.accountId != null) query.set('accountId', String(params.accountId));
  if (params.type) query.set('type', params.type);
  if (params.categoryId != null) query.set('categoryId', String(params.categoryId));
  if (params.needsReview != null) query.set('needsReview', String(params.needsReview));
  if (params.q) query.set('q', params.q);
  if (params.page != null) query.set('page', String(params.page));
  if (params.size != null) query.set('size', String(params.size));
  if (params.sort) query.set('sort', params.sort);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch(`/transactions${suffix}`);
  return requireOkJson<PagedTransactionResponse>(res);
}

export async function createTransaction(req: TransactionCreateRequest): Promise<TransactionResponse> {
  await ensureXsrfCookie();
  const res = await apiFetch('/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  return requireOkJson<TransactionResponse>(res);
}

export async function getTransaction(id: number): Promise<TransactionResponse> {
  const res = await apiFetch(`/transactions/${id}`);
  return requireOkJson<TransactionResponse>(res);
}

export async function patchTransaction(id: number, req: TransactionPatchRequest): Promise<TransactionResponse> {
  await ensureXsrfCookie();
  const res = await apiFetch(`/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  return requireOkJson<TransactionResponse>(res);
}

export async function deleteTransaction(id: number): Promise<void> {
  await ensureXsrfCookie();
  const res = await apiFetch(`/transactions/${id}`, { method: 'DELETE' });
  if (res.status === 204) return;
  await requireOkJson<unknown>(res);
}

export async function listCategories(type?: TransactionType): Promise<CategoryListResponse> {
  const suffix = type ? `?type=${encodeURIComponent(type)}` : '';
  const res = await apiFetch(`/categories${suffix}`);
  return requireOkJson<CategoryListResponse>(res);
}

export async function createCategory(req: CategoryCreateRequest): Promise<CategoryResponse> {
  await ensureXsrfCookie();
  const res = await apiFetch('/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  return requireOkJson<CategoryResponse>(res);
}

export async function patchCategory(id: number, req: CategoryPatchRequest): Promise<CategoryResponse> {
  await ensureXsrfCookie();
  const res = await apiFetch(`/categories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  return requireOkJson<CategoryResponse>(res);
}
