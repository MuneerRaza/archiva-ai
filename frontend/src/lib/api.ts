const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

interface ApiErrorResponse {
  error: ApiError;
}

export class ApiRequestError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = "ApiRequestError";
    this.code = error.code;
    this.status = status;
    this.details = error.details;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}/api${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json()) as ApiErrorResponse;
    throw new ApiRequestError(response.status, body.error);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};
