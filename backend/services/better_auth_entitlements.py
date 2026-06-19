"""
Commercial entitlement helpers for BetterAuth users.
"""
from sqlalchemy.orm import Session

from backend.better_auth import BetterAuthUser
from backend.models import BetterAuthEntitlement


def get_or_create_entitlement(
    db: Session,
    user: BetterAuthUser,
) -> BetterAuthEntitlement:
    entitlement = (
        db.query(BetterAuthEntitlement)
        .filter(BetterAuthEntitlement.better_auth_user_id == user.id)
        .first()
    )

    if not entitlement:
        entitlement = BetterAuthEntitlement(
            better_auth_user_id=user.id,
            email=user.email,
            name=user.name,
            image=user.image,
        )
        db.add(entitlement)
    else:
        entitlement.email = user.email
        entitlement.name = user.name
        entitlement.image = user.image

    db.commit()
    db.refresh(entitlement)
    return entitlement
