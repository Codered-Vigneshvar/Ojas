"""
One-time backfill: generate synopsis for all consultations that have a
clinical_manifest (i.e. were previously consolidated) but no synopsis yet.

Run from apps/api/:
    PYTHONPATH=src uv run python scripts/backfill_synopsis.py
"""

import asyncio
import uuid
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sqlalchemy import select
from ojas.db.session import async_session_factory
from ojas.models.consultation import Consultation
from ojas.services.consolidation_service import consolidate_consultation


async def backfill() -> None:
    async with async_session_factory() as session:
        result = await session.execute(
            select(Consultation.id)
            .where(
                Consultation.clinical_manifest.isnot(None),
                Consultation.synopsis.is_(None),
            )
        )
        ids: list[uuid.UUID] = list(result.scalars().all())

    total = len(ids)
    if total == 0:
        print("Nothing to backfill — all consultations already have a synopsis.")
        return

    print(f"Found {total} consultation(s) to backfill.")

    for i, consultation_id in enumerate(ids, 1):
        print(f"  [{i}/{total}] {consultation_id} ...", end=" ", flush=True)
        try:
            async with async_session_factory() as session:
                await consolidate_consultation(session, consultation_id)
            print("done")
        except Exception as e:
            print(f"FAILED: {e}")

    print(f"\nBackfill complete. {total} consultation(s) processed.")


if __name__ == "__main__":
    asyncio.run(backfill())
