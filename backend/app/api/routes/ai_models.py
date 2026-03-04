import uuid

import httpx
from fastapi import APIRouter

from app.api.deps import CurrentUser, DbConn
from app.exceptions import LLMError, NotFoundError, PermissionDeniedError
from app.logging import get_logger
from app.models.ai_model import (
    AIModelCreate,
    AIModelProvider,
    AIModelResponse,
    AIModelTestRequest,
    AIModelTestResult,
    AIModelUpdate,
    ModelType,
)
from app.models.responses import DataResponse, ListResponse, Pagination
from app.repositories.ai_model import AIModelRepository
from app.repositories.workspace import WorkspaceRepository
from app.services.agent.capabilities import detect_all_capabilities
from app.services.agent.session_cache import invalidate_all_sessions
from app.services.llm.factory import get_llm_provider

logger = get_logger(__name__)

router = APIRouter(prefix="/ai-models", tags=["ai-models"])


async def _get_org_id(conn: DbConn, user: CurrentUser) -> uuid.UUID:
    repo = WorkspaceRepository(conn)
    org_id = await repo.get_org_id_for_user(user.id)
    if not org_id:
        raise PermissionDeniedError("No organization found for user")
    return org_id


@router.get("", response_model=ListResponse[AIModelResponse])
async def list_ai_models(
    conn: DbConn,
    user: CurrentUser,
) -> ListResponse[AIModelResponse]:
    org_id = await _get_org_id(conn, user)
    repo = AIModelRepository(conn)
    rows = await repo.list_by_org(org_id)
    models = [AIModelResponse.from_row(r) for r in rows]
    return ListResponse(
        data=models,
        pagination=Pagination(
            total=len(models),
            limit=len(models),
            offset=0,
            has_more=False,
        ),
    )


@router.post("", response_model=DataResponse[AIModelResponse], status_code=201)
async def create_ai_model(
    body: AIModelCreate,
    conn: DbConn,
    user: CurrentUser,
) -> DataResponse[AIModelResponse]:
    org_id = await _get_org_id(conn, user)
    repo = AIModelRepository(conn)
    row = await repo.create(
        org_id=org_id,
        label=body.label,
        model_type=body.model_type.value,
        provider=body.provider.value,
        model=body.model,
        base_url=body.base_url,
        api_key=body.api_key,
        capabilities=body.capabilities,
        context_length=body.context_length,
    )
    return DataResponse(data=AIModelResponse.from_row(row))


@router.patch("/{model_id}", response_model=DataResponse[AIModelResponse])
async def update_ai_model(
    model_id: uuid.UUID,
    body: AIModelUpdate,
    conn: DbConn,
    user: CurrentUser,
) -> DataResponse[AIModelResponse]:
    org_id = await _get_org_id(conn, user)
    repo = AIModelRepository(conn)

    row = await repo.update(
        model_id=model_id,
        org_id=org_id,
        label=body.label,
        model_type=body.model_type.value if body.model_type else None,
        provider=body.provider.value if body.provider else None,
        model=body.model,
        base_url=body.base_url,
        api_key=body.api_key,
        capabilities=body.capabilities,
        context_length=body.context_length,
    )
    if not row:
        raise NotFoundError("AI model", str(model_id))
    invalidate_all_sessions()
    return DataResponse(data=AIModelResponse.from_row(row))


@router.delete("/{model_id}", status_code=204)
async def delete_ai_model(
    model_id: uuid.UUID,
    conn: DbConn,
    user: CurrentUser,
) -> None:
    org_id = await _get_org_id(conn, user)
    repo = AIModelRepository(conn)

    deleted = await repo.delete(model_id, org_id=org_id)
    if not deleted:
        raise NotFoundError("AI model", str(model_id))
    invalidate_all_sessions()


_TRANSCRIPTION_PROVIDER_URLS = {
    AIModelProvider.OPENAI: "https://api.openai.com/v1",
    AIModelProvider.GROQ: "https://api.groq.com/openai/v1",
}


async def _test_transcription_model(
    provider: AIModelProvider, model: str, base_url: str, api_key: str,
) -> tuple[bool, str]:
    """Test a transcription model by verifying it appears in the models list."""
    url = (base_url or _TRANSCRIPTION_PROVIDER_URLS.get(provider, "")).rstrip("/")
    if not url:
        return (False, "No base URL for this provider")

    headers: dict[str, str] = {"Authorization": f"Bearer {api_key}"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{url}/models", headers=headers)
            if resp.status_code in (401, 403):
                return (False, "Authentication failed — check your API key")
            resp.raise_for_status()
            data = resp.json()
            model_ids = [m.get("id", "") for m in data.get("data", [])]
            if model in model_ids:
                return (True, model)
            return (False, f"Model '{model}' not found. Available: {', '.join(model_ids[:10])}")
    except httpx.ConnectError:
        return (False, f"Connection refused — cannot reach {url}")
    except httpx.TimeoutException:
        return (False, f"Connection timed out reaching {url}")
    except Exception as exc:
        return (False, str(exc))


@router.post("/test", response_model=DataResponse[AIModelTestResult])
async def test_ai_model(
    body: AIModelTestRequest,
    user: CurrentUser,
) -> DataResponse[AIModelTestResult]:
    if body.model_type == ModelType.TRANSCRIPTION:
        success, message = await _test_transcription_model(
            body.provider, body.model, body.base_url or "", body.api_key or "",
        )
        result = AIModelTestResult(success=success, error=message if not success else None)
        return DataResponse(data=result)

    provider = get_llm_provider({
        "provider": body.provider.value,
        "model": body.model,
        "base_url": body.base_url,
        "api_key": body.api_key or "",
    })
    success, message = await provider.test_connection()

    capabilities: list[str] = []
    if success:
        try:
            capabilities = await detect_all_capabilities(
                body.provider.value, body.model, body.base_url,
            )
        except (httpx.ConnectError, httpx.TimeoutException) as exc:
            logger.warning("capability_detection_failed", error=str(exc))

    result = AIModelTestResult(
        success=success,
        error=message if not success else None,
        capabilities=capabilities,
    )
    return DataResponse(data=result)


@router.post(
    "/{model_id}/refresh-capabilities",
    response_model=DataResponse[AIModelResponse],
)
async def refresh_capabilities(
    model_id: uuid.UUID,
    conn: DbConn,
    user: CurrentUser,
) -> DataResponse[AIModelResponse]:
    org_id = await _get_org_id(conn, user)
    repo = AIModelRepository(conn)

    existing = await repo.get_by_id(model_id)
    if not existing or existing["org_id"] != org_id:
        raise NotFoundError("AI model", str(model_id))

    try:
        caps = await detect_all_capabilities(
            existing["provider"], existing["model"], existing["base_url"] or "",
        )
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        logger.warning("refresh_capabilities_failed", model_id=str(model_id), error=str(exc))
        raise LLMError(
            f"Cannot reach {existing['provider']} — is it running?",
        ) from exc

    row = await repo.update_capabilities(model_id, caps)
    if not row:
        raise NotFoundError("AI model", str(model_id))
    return DataResponse(data=AIModelResponse.from_row(row))
