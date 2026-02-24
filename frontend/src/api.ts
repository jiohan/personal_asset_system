export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    fieldErrors?: { field: string; reason: string }[];
  };
};

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

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function requireOkJson<T>(res: Response): Promise<T> {
  if (res.ok) return readJson<T>(res);

  let message = `Request failed (${res.status}).`;
  try {
    const body = await readJson<ApiErrorResponse>(res);
    message = body.error?.message ?? message;
  } catch {
    message = `Request failed (${res.status}).`;
  }

  throw new Error(message);
}

export async function getMe(): Promise<AuthMeResponse | null> {
  const res = await apiFetch('/auth/me');
  if (res.status === 401) return null;
  return requireOkJson<AuthMeResponse>(res);
}

export async function signup(req: AuthSignupRequest): Promise<AuthMeResponse> {
  const res = await apiFetch('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  return requireOkJson<AuthMeResponse>(res);
}

export async function login(req: AuthLoginRequest): Promise<AuthMeResponse> {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  return requireOkJson<AuthMeResponse>(res);
}

export async function logout(): Promise<void> {
  const res = await apiFetch('/auth/logout', { method: 'POST' });
  if (res.status === 204) return;
  await requireOkJson<unknown>(res);
}
