from __future__ import annotations

from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

from backend.agent.model_profiles import get_default_profile_name, list_model_options

router = APIRouter(prefix="/config", tags=["config"])


class AgentModelOption(BaseModel):
    id: str
    label: str
    provider: str
    description: str
    model: str
    configured: bool
    supported: bool
    available: bool
    disabled_reason: str | None = None
    is_default: bool


class AgentModelOptionsResponse(BaseModel):
    selected: str
    models: List[AgentModelOption]


@router.get("/models", response_model=AgentModelOptionsResponse)
async def get_agent_models() -> AgentModelOptionsResponse:
    models = [AgentModelOption(**item) for item in list_model_options()]
    return AgentModelOptionsResponse(
        selected=get_default_profile_name(),
        models=models,
    )
