import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
const API_ROOT = API_BASE ? `${API_BASE}/api` : "/api";

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

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_ROOT}${path}`;
  const token = await getAccessToken();

  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorPayload: ApiError;
    try {
      const body = await response.json();
      if (body?.error?.message) {
        errorPayload = body.error;
      } else if (body?.detail) {
        // FastAPI validation error format
        const detail = typeof body.detail === "string"
          ? body.detail
          : JSON.stringify(body.detail);
        errorPayload = { code: "validation_error", message: detail };
      } else {
        errorPayload = { code: "unknown", message: `Request failed (${response.status})` };
      }
    } catch {
      errorPayload = { code: "unknown", message: `Request failed (${response.status})` };
    }
    throw new ApiRequestError(response.status, errorPayload);
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

  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    }),

  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, {
      method: "POST",
      body: formData,
    }),
};
