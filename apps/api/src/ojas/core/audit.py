import uuid
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from ojas.models.audit_log import AuditLog

logger = structlog.get_logger(__name__)


async def audit_log(
    session: AsyncSession,
    actor_id: uuid.UUID,
    action: str,
    resource_type: str,
    resource_id: uuid.UUID | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Write an audit entry. Never include raw PHI in metadata — only IDs and action codes."""
    entry = AuditLog(
        actor_user_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        audit_metadata=metadata or {},
    )
    session.add(entry)
    logger.info(
        "audit",
        actor_id=str(actor_id),
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
    )
