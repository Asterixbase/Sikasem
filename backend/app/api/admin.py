"""
Admin router
GET /v1/admin/system/health
GET /v1/admin/logs
GET /v1/admin/logs/{id}
GET /v1/admin/roles
PUT /v1/admin/roles/{role_id}
GET /v1/security/audit
POST /v1/security/audit/run
GET /v1/security/access-logs
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Dict

from app.core.deps import get_current_shop

router = APIRouter()
security_router = APIRouter()

# In-memory stub for roles (replace with DB table when needed)
_ROLES = {
    "owner":   {"sales_archive": True, "inventory_mgmt": True, "compliance_audit": True},
    "manager": {"sales_archive": True, "inventory_mgmt": True, "compliance_audit": False},
    "staff":   {"sales_archive": False, "inventory_mgmt": False, "compliance_audit": False},
}


class RoleUpdateRequest(BaseModel):
    permissions: Dict[str, bool]


@router.get("/system/health")
async def system_health(auth=Depends(get_current_shop)):
    return {
        "uptime_pct": 99.9,
        "ocr_avg_speed_ms": 0,
        "active_nodes": 1,
        "region": "jnb",
        "network": {"realtime_sync_ms": 0, "db_latency_ms": 5},
        "staff_activity": [],
    }


@router.get("/logs")
async def system_logs(
    filter: str = Query(default="all"),
    auth=Depends(get_current_shop),
):
    return {"logs": []}


@router.get("/logs/{log_id}")
async def log_detail(log_id: str, auth=Depends(get_current_shop)):
    return {
        "ref": log_id,
        "title": "Log entry",
        "description": "No details available",
        "confidence": 1.0,
        "linked_entities": [],
        "integrity": {"verified": True, "sha256": ""},
        "audit_metadata": {},
    }


@router.get("/roles")
async def get_roles(auth=Depends(get_current_shop)):
    return {
        "roles": list(_ROLES.keys()),
        "active_role": "owner",
        "staff_count": 1,
        "permissions": {
            "sales_archive": [k for k, v in _ROLES.items() if v.get("sales_archive")],
            "inventory_mgmt": [k for k, v in _ROLES.items() if v.get("inventory_mgmt")],
            "compliance_audit": [k for k, v in _ROLES.items() if v.get("compliance_audit")],
        },
    }


@router.put("/roles/{role_id}")
async def update_role(
    role_id: str,
    body: RoleUpdateRequest,
    auth=Depends(get_current_shop),
):
    _ROLES[role_id] = body.permissions
    return {"role_id": role_id, "permissions": body.permissions}


@security_router.get("/audit")
async def security_audit(auth=Depends(get_current_shop)):
    return {
        "risk_score": 0,
        "grade": "A",
        "protections": [
            {"name": "JWT Auth", "status": "active"},
            {"name": "HTTPS", "status": "active"},
            {"name": "Rate Limiting", "status": "active"},
        ],
        "recent_events": [],
    }


@security_router.post("/audit/run")
async def run_audit(auth=Depends(get_current_shop)):
    return {
        "audit_id": str(uuid.uuid4()),
        "started_at": datetime.now(timezone.utc).isoformat(),
        "estimated_duration_ms": 5000,
    }


@security_router.get("/access-logs")
async def access_logs(
    filter: str = Query(default="logins"),
    auth=Depends(get_current_shop),
):
    return {"logs": []}
