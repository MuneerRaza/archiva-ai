from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


class Pagination(BaseModel):
    total: int
    limit: int
    offset: int
    has_more: bool


class DataResponse[T](BaseModel):
    data: T


class ListResponse[T](BaseModel):
    data: list[T]
    pagination: Pagination
