"""
Configuration specification for SMARTTRUST Analytics Engine.
All thresholds, window sizes, and severity cut-offs live in this configuration.
No magic numbers are allowed in business logic modules.
"""

from copy import deepcopy
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional
import yaml


@dataclass
class EnergyConfig:
    baseline_window_days: int = 30
    baseline_method: str = "median"  # 'median' with fallback to 'mean'
    min_history_records: int = 7
    threshold_low_pct: float = 15.0
    threshold_med_pct: float = 30.0
    threshold_high_pct: float = 50.0
    robust_zscore_threshold: float = 2.5
    divide_by_zero_epsilon: float = 1e-6
    enable_isolation_forest: bool = False
    isolation_forest_contamination: float = 0.05
    isolation_forest_min_samples: int = 10
    random_seed: int = 42


@dataclass
class HygieneConfig:
    compliance_band_critical: float = 60.0  # < 60% compliance -> CRITICAL
    compliance_band_high: float = 75.0      # < 75% compliance -> HIGH
    compliance_band_medium: float = 90.0    # < 90% compliance -> MEDIUM
    compliance_band_low: float = 98.0       # < 98% compliance -> LOW
    repeated_missed_threshold_count: int = 3
    repeated_missed_window_days: int = 7


@dataclass
class WasteConfig:
    milk_loss_pct_low: float = 1.5
    milk_loss_pct_med: float = 3.0
    milk_loss_pct_high: float = 5.0
    milk_loss_pct_critical: float = 10.0
    default_packaging_per_unit_ratio: float = 1.0
    damaged_pkg_pct_low: float = 2.0
    damaged_pkg_pct_med: float = 5.0
    damaged_pkg_pct_high: float = 10.0
    damaged_pkg_pct_critical: float = 20.0
    excess_pkg_pct_low: float = 5.0
    excess_pkg_pct_med: float = 10.0
    excess_pkg_pct_high: float = 20.0
    excess_pkg_pct_critical: float = 35.0
    divide_by_zero_epsilon: float = 1e-6
    candidate_investigation_reasons: List[str] = field(
        default_factory=lambda: [
            "damaged in process",
            "rejected in quality inspection",
            "over-issuance or handling spoilage",
            "recording or count reporting error",
        ]
    )


@dataclass
class AnalyticsConfig:
    data_source_default: str = "REAL"  # 'REAL' or 'SIMULATED'
    energy: EnergyConfig = field(default_factory=EnergyConfig)
    hygiene: HygieneConfig = field(default_factory=HygieneConfig)
    waste: WasteConfig = field(default_factory=WasteConfig)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]] = None) -> "AnalyticsConfig":
        if not data:
            return cls()
        data_copy = deepcopy(data)
        energy_data = data_copy.pop("energy", {})
        hygiene_data = data_copy.pop("hygiene", {})
        waste_data = data_copy.pop("waste", {})

        return cls(
            data_source_default=data_copy.get("data_source_default", "REAL"),
            energy=EnergyConfig(**energy_data) if isinstance(energy_data, dict) else EnergyConfig(),
            hygiene=HygieneConfig(**hygiene_data) if isinstance(hygiene_data, dict) else HygieneConfig(),
            waste=WasteConfig(**waste_data) if isinstance(waste_data, dict) else WasteConfig(),
        )

    @classmethod
    def from_yaml_file(cls, path: Path | str) -> "AnalyticsConfig":
        file_path = Path(path)
        if not file_path.exists():
            return cls()
        with open(file_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return cls.from_dict(data)


DEFAULT_CONFIG = AnalyticsConfig()
