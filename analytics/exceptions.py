"""
Custom exceptions for the SMARTTRUST Analytics Engine.
All exceptions provide structured metadata identifying field, row, or entity.
"""

from typing import Any, Dict, List, Optional


class AnalyticsException(Exception):
    """Base exception for all SMARTTRUST analytics errors."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error_type": self.__class__.__name__,
            "message": self.message,
            "details": self.details,
        }


class ValidationError(AnalyticsException):
    """Raised when data values fail semantic validation (e.g. negative, impossible)."""

    def __init__(
        self,
        message: str,
        field: Optional[str] = None,
        row: Optional[int] = None,
        value: Optional[Any] = None,
        dataset: Optional[str] = None,
    ):
        details = {
            "field": field,
            "row": row,
            "value": value,
            "dataset": dataset,
        }
        super().__init__(message, details)
        self.field = field
        self.row = row
        self.value = value
        self.dataset = dataset


class SchemaError(AnalyticsException):
    """Raised when required schema columns are missing or types are mismatched."""

    def __init__(
        self,
        message: str,
        dataset: str,
        missing_columns: Optional[List[str]] = None,
        present_columns: Optional[List[str]] = None,
    ):
        details = {
            "dataset": dataset,
            "missing_columns": missing_columns or [],
            "present_columns": present_columns or [],
        }
        super().__init__(message, details)
        self.dataset = dataset
        self.missing_columns = missing_columns or []
        self.present_columns = present_columns or []


class InsufficientDataError(AnalyticsException):
    """Raised when an operation cannot be performed due to insufficient records."""

    def __init__(
        self,
        message: str,
        identifier: str,
        records_found: int,
        records_required: int,
    ):
        details = {
            "identifier": identifier,
            "records_found": records_found,
            "records_required": records_required,
        }
        super().__init__(message, details)
        self.identifier = identifier
        self.records_found = records_found
        self.records_required = records_required
