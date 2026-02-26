from enum import StrEnum


class ErrorCode(StrEnum):
    NOT_FOUND = "not_found"
    PERMISSION_DENIED = "permission_denied"
    VALIDATION_ERROR = "validation_error"
    CONFLICT = "conflict"
    STORAGE_ERROR = "storage_error"
    PROCESSING_ERROR = "processing_error"
    LLM_ERROR = "llm_error"
    AUTH_ERROR = "auth_error"
    RATE_LIMITED = "rate_limited"
    INTERNAL_ERROR = "internal_error"


class ArchivaError(Exception):
    """Base exception for all Archiva application errors."""

    def __init__(
        self,
        message: str,
        code: ErrorCode = ErrorCode.INTERNAL_ERROR,
        status_code: int = 500,
        details: dict | None = None,
    ) -> None:
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class NotFoundError(ArchivaError):
    def __init__(self, resource: str, identifier: str | None = None) -> None:
        detail = f"{resource} not found"
        if identifier:
            detail = f"{resource} '{identifier}' not found"
        super().__init__(
            message=detail,
            code=ErrorCode.NOT_FOUND,
            status_code=404,
            details={"resource": resource, "identifier": identifier},
        )


class PermissionDeniedError(ArchivaError):
    def __init__(self, message: str = "Permission denied") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.PERMISSION_DENIED,
            status_code=403,
        )


class ValidationError(ArchivaError):
    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(
            message=message,
            code=ErrorCode.VALIDATION_ERROR,
            status_code=422,
            details=details or {},
        )


class ConflictError(ArchivaError):
    def __init__(self, message: str) -> None:
        super().__init__(
            message=message,
            code=ErrorCode.CONFLICT,
            status_code=409,
        )


class StorageError(ArchivaError):
    def __init__(self, message: str) -> None:
        super().__init__(
            message=message,
            code=ErrorCode.STORAGE_ERROR,
            status_code=502,
        )


class ProcessingError(ArchivaError):
    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(
            message=message,
            code=ErrorCode.PROCESSING_ERROR,
            status_code=500,
            details=details or {},
        )


class LLMError(ArchivaError):
    def __init__(self, message: str) -> None:
        super().__init__(
            message=message,
            code=ErrorCode.LLM_ERROR,
            status_code=502,
        )


class AuthError(ArchivaError):
    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.AUTH_ERROR,
            status_code=401,
        )


class RateLimitedError(ArchivaError):
    def __init__(self, message: str = "Rate limit exceeded") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.RATE_LIMITED,
            status_code=429,
        )
