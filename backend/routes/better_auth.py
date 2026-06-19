"""
BetterAuth integration routes.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from backend.database import get_db
from backend.better_auth import (
    BetterAuthUser,
    get_better_auth_base_url,
    get_current_better_auth_user,
    has_internal_auth_secret,
)
from backend.services.better_auth_entitlements import get_or_create_entitlement

router = APIRouter(prefix="/api/auth/better", tags=["BetterAuth"])


class EntitlementResponse(BaseModel):
    plan: str
    credits: int
    daily_usage_count: int
    subscription_status: str
    provider_customer_id: str | None = None
    provider_subscription_id: str | None = None
    current_period_end: str | None = None


class BetterAuthAccountResponse(BaseModel):
    user: BetterAuthUser
    entitlement: EntitlementResponse


class BetterAuthHealthResponse(BaseModel):
    better_auth_internal_url: str
    better_auth_internal_url_configured: bool
    fastapi_internal_auth_secret_configured: bool
    entitlement_table_ready: bool


@router.get("/health", response_model=BetterAuthHealthResponse)
def better_auth_health(db: Session = Depends(get_db)) -> BetterAuthHealthResponse:
    entitlement_table_ready = True
    try:
        db.execute(text("SELECT 1 FROM better_auth_entitlements LIMIT 1"))
    except SQLAlchemyError:
        entitlement_table_ready = False

    base_url = get_better_auth_base_url()
    return BetterAuthHealthResponse(
        better_auth_internal_url=base_url,
        better_auth_internal_url_configured=bool(base_url),
        fastapi_internal_auth_secret_configured=has_internal_auth_secret(),
        entitlement_table_ready=entitlement_table_ready,
    )


@router.get("/me", response_model=BetterAuthUser)
async def better_auth_me(
    current_user: BetterAuthUser = Depends(get_current_better_auth_user),
) -> BetterAuthUser:
    return current_user


@router.get("/account", response_model=BetterAuthAccountResponse)
async def better_auth_account(
    current_user: BetterAuthUser = Depends(get_current_better_auth_user),
    db: Session = Depends(get_db),
) -> BetterAuthAccountResponse:
    entitlement = get_or_create_entitlement(db, current_user)
    return BetterAuthAccountResponse(
        user=current_user,
        entitlement=EntitlementResponse(
            plan=entitlement.plan,
            credits=entitlement.credits,
            daily_usage_count=entitlement.daily_usage_count,
            subscription_status=entitlement.subscription_status,
            provider_customer_id=entitlement.provider_customer_id,
            provider_subscription_id=entitlement.provider_subscription_id,
            current_period_end=(
                entitlement.current_period_end.isoformat()
                if entitlement.current_period_end
                else None
            ),
        ),
    )
