"""
Map BetterAuth users to legacy User records for existing business routes.
"""
import re
import secrets

from sqlalchemy.orm import Session

from backend.auth import hash_password
from backend.better_auth import BetterAuthUser
from backend.models import User


def _derive_username(better_user: BetterAuthUser) -> str:
    if better_user.name:
        slug = re.sub(r"[^\w\-]+", "", better_user.name.replace(" ", "-"), flags=re.UNICODE)
        if slug:
            return slug[:64]
    if better_user.email:
        return better_user.email.split("@")[0][:64]
    return f"user-{better_user.id[:12]}"


def _unique_username(db: Session, base: str) -> str:
    candidate = base
    suffix = 1
    while db.query(User).filter(User.username == candidate).first():
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def resolve_legacy_user(db: Session, better_user: BetterAuthUser) -> User:
    email = (better_user.email or "").strip().lower()
    if email:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            return existing

    username = _unique_username(db, _derive_username(better_user))
    email_value = email or f"{username}@better-auth.local"
    if not email:
        while db.query(User).filter(User.email == email_value).first():
            email_value = f"{username}-{secrets.token_hex(3)}@better-auth.local"

    user = User(
        username=username,
        email=email_value,
        password_hash=hash_password(f"better-auth:{better_user.id}:{secrets.token_hex(8)}"),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user