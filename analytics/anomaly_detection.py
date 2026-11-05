"""
Statistical and Machine Learning anomaly detection utilities for SMARTTRUST.
Follows explainable-first principles: statistical baselines, robust z-scores (MAD),
and optional scikit-learn IsolationForest secondary confirmation.
"""

from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from .config import EnergyConfig


def calculate_baseline(
    series: pd.Series,
    window: int = 30,
    method: str = "median",
    min_records: int = 7,
) -> Tuple[Optional[float], str]:
    """
    Computes historical baseline using rolling median (or fallback to mean).
    Requires at least `min_records`; returns (None, 'INSUFFICIENT_BASELINE') if not met.
    """
    clean_series = series.dropna()
    count = len(clean_series)
    if count < min_records:
        return None, "INSUFFICIENT_BASELINE"

    # Use the most recent window records
    window_data = clean_series.tail(window)
    if method == "median":
        baseline = float(window_data.median())
    elif method == "mean":
        baseline = float(window_data.mean())
    else:
        # Fallback to median
        baseline = float(window_data.median())

    return baseline, f"CALCULATED_FROM_{len(window_data)}_RECORDS"


def calculate_percentage_increase(
    actual: float,
    baseline: float,
    epsilon: float = 1e-6,
) -> float:
    """
    Calculates percentage increase with divide-by-zero guard:
    ((actual - baseline) / baseline) * 100
    """
    safe_baseline = baseline if abs(baseline) > epsilon else epsilon
    return float(((actual - baseline) / safe_baseline) * 100.0)


def calculate_robust_zscore(
    value: float,
    history: pd.Series,
    epsilon: float = 1e-6,
) -> Tuple[float, float, float]:
    """
    Calculates robust z-score using Median and Median Absolute Deviation (MAD):
    MAD = median(|x - median(X)|)
    robust_z = 0.6745 * (value - median) / MAD
    Returns: (robust_z, median, mad)
    """
    clean = history.dropna()
    if clean.empty:
        return 0.0, 0.0, 0.0

    med = float(clean.median())
    abs_deviations = (clean - med).abs()
    mad = float(abs_deviations.median())

    if mad > epsilon:
        # 0.6745 factor normalizes MAD to standard deviation equivalent for normal distributions
        robust_z = float(0.6745 * (value - med) / mad)
    else:
        # Fallback to standard deviation if MAD is zero
        std = float(clean.std(ddof=0))
        if std > epsilon:
            robust_z = float((value - med) / std)
        else:
            robust_z = 0.0

    return robust_z, med, mad


def calculate_linear_trend(
    dates: pd.Series,
    values: pd.Series,
    stable_threshold_pct: float = 2.0,
) -> Dict[str, Any]:
    """
    Calculates chronological trend slope and direction (INCREASING, DECREASING, STABLE).
    """
    clean = pd.DataFrame({"date": dates, "val": values}).dropna().sort_values("date")
    if len(clean) < 2:
        return {
            "slope": 0.0,
            "direction": "INSUFFICIENT_HISTORY",
            "percent_change": 0.0,
        }

    # x as integer days relative to first date
    first_date = clean["date"].iloc[0]
    x = (clean["date"] - first_date).apply(lambda d: d.days if hasattr(d, "days") else 0).values.astype(float)
    y = clean["val"].values.astype(float)

    # If all x are equal (e.g. same day), fallback to simple index
    if np.all(x == x[0]):
        x = np.arange(len(y), dtype=float)

    # Linear fit: y = slope * x + intercept
    slope, intercept = np.polyfit(x, y, 1)

    # Compare first vs last predicted or actual
    start_val = y[0] if abs(y[0]) > 1e-6 else 1e-6
    end_val = y[-1]
    pct_change = ((end_val - start_val) / start_val) * 100.0

    if pct_change > stable_threshold_pct:
        direction = "INCREASING"
    elif pct_change < -stable_threshold_pct:
        direction = "DECREASING"
    else:
        direction = "STABLE"

    return {
        "slope": round(float(slope), 4),
        "direction": direction,
        "percent_change": round(float(pct_change), 2),
    }


def run_isolation_forest_check(
    values: pd.Series,
    latest_value: float,
    contamination: float = 0.05,
    min_samples: int = 10,
    random_seed: int = 42,
) -> Optional[bool]:
    """
    Optional secondary ML check using scikit-learn IsolationForest.
    Returns:
      True if the latest value is confirmed anomalous (-1),
      False if normal (1),
      None if data volume is below min_samples or check disabled.
    """
    clean = values.dropna().values
    if len(clean) < min_samples:
        return None

    # Reshape for scikit-learn
    X = clean.reshape(-1, 1)
    clf = IsolationForest(
        contamination=contamination,
        random_state=random_seed,
        n_estimators=100,
    )
    clf.fit(X)
    pred = clf.predict(np.array([[latest_value]]))
    # 1 for normal, -1 for anomaly
    return bool(pred[0] == -1)
