"""
FastAPI Thin Wrapper for SMARTTRUST Dairy Plant Analytics Engine.
Provides HTTP REST endpoints for backend integration with Pydantic validation.
"""

from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .config import AnalyticsConfig
from .engine import (
    run_analytics,
    run_energy_analytics,
    run_hygiene_analytics,
    run_waste_analytics,
)
from .exceptions import AnalyticsException, SchemaError, ValidationError

app = FastAPI(
    title="SMARTTRUST Dairy Plant Analytics API",
    description="Analytics engine for dairy plant operations (DL-SJBIT-HK26-GOVP010 | LAKSHYA 2026)",
    version="1.0.0",
)


@app.exception_handler(ValidationError)
async def validation_exception_handler(request, exc: ValidationError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=exc.to_dict(),
    )


@app.exception_handler(SchemaError)
async def schema_exception_handler(request, exc: SchemaError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=exc.to_dict(),
    )


# --- Request Models ---

class EnergyRecordItem(BaseModel):
    date: str
    machine_id: str
    machine_name: str
    energy_kwh: float
    runtime_hours: Optional[float] = None
    production_units: Optional[float] = None
    machine_type: Optional[str] = None


class EnergyAnalyzeRequest(BaseModel):
    energy_records: List[Dict[str, Any]]
    config: Optional[Dict[str, Any]] = None
    data_source: Optional[str] = "REAL"


class CleaningScheduleItem(BaseModel):
    equipment_id: str
    equipment_name: str
    required_frequency: str
    required_times_per_period: float


class CleaningRecordItem(BaseModel):
    date: str
    shift: str
    equipment_id: str
    status: str
    submitted_by: str
    verified_by: str
    completion_percent: Optional[float] = None


class HygieneAnalyzeRequest(BaseModel):
    cleaning_records: List[Dict[str, Any]]
    cleaning_schedule: List[Dict[str, Any]]
    config: Optional[Dict[str, Any]] = None
    data_source: Optional[str] = "REAL"


class WasteAnalyzeRequest(BaseModel):
    production_records: List[Dict[str, Any]]
    milk_loss_records: Optional[List[Dict[str, Any]]] = None
    packaging_records: Optional[List[Dict[str, Any]]] = None
    config: Optional[Dict[str, Any]] = None
    data_source: Optional[str] = "REAL"


class AllAnalyzeRequest(BaseModel):
    energy_records: Optional[List[Dict[str, Any]]] = None
    cleaning_records: Optional[List[Dict[str, Any]]] = None
    cleaning_schedule: Optional[List[Dict[str, Any]]] = None
    production_records: Optional[List[Dict[str, Any]]] = None
    milk_loss_records: Optional[List[Dict[str, Any]]] = None
    packaging_records: Optional[List[Dict[str, Any]]] = None
    config: Optional[Dict[str, Any]] = None
    data_source: Optional[str] = "REAL"


# --- Endpoints ---

@app.get("/health", tags=["System"])
def health_check():
    """Health check endpoint confirming engine readiness."""
    return {
        "status": "healthy",
        "service": "SMARTTRUST-Analytics",
        "version": "1.0.0",
        "supported_modules": ["energy", "hygiene", "waste", "all"],
    }


@app.post("/analyze/energy", tags=["Analytics"])
def analyze_energy_endpoint(payload: EnergyAnalyzeRequest):
    """Analyzes machine energy records for baseline deviations and inefficiencies."""
    try:
        cfg = AnalyticsConfig.from_dict(payload.config) if payload.config else None
        res = run_energy_analytics(
            energy_records=payload.energy_records,
            config=cfg,
            data_source=payload.data_source,
        )
        return res
    except AnalyticsException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/hygiene", tags=["Analytics"])
def analyze_hygiene_endpoint(payload: HygieneAnalyzeRequest):
    """Analyzes sanitation cleaning records against prescribed cleaning schedule."""
    try:
        cfg = AnalyticsConfig.from_dict(payload.config) if payload.config else None
        res = run_hygiene_analytics(
            cleaning_records=payload.cleaning_records,
            cleaning_schedule=payload.cleaning_schedule,
            config=cfg,
            data_source=payload.data_source,
        )
        return res
    except AnalyticsException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/waste", tags=["Analytics"])
def analyze_waste_endpoint(payload: WasteAnalyzeRequest):
    """Analyzes milk processing losses and reconciles packaging material usage."""
    try:
        cfg = AnalyticsConfig.from_dict(payload.config) if payload.config else None
        res = run_waste_analytics(
            production_records=payload.production_records,
            milk_loss_records=payload.milk_loss_records,
            packaging_records=payload.packaging_records,
            config=cfg,
            data_source=payload.data_source,
        )
        return res
    except AnalyticsException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/all", tags=["Analytics"])
def analyze_all_endpoint(payload: AllAnalyzeRequest):
    """Runs end-to-end multi-module analytics and produces executive insights."""
    try:
        inputs = payload.model_dump()
        config_override = inputs.pop("config", None)
        return run_analytics(inputs=inputs, config=config_override)
    except AnalyticsException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
