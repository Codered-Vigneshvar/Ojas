from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class OjasError(Exception):
    """Base domain exception."""

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    detail: str = "An unexpected error occurred"

    def __init__(self, detail: str | None = None) -> None:
        self.detail = detail or self.__class__.detail
        super().__init__(self.detail)


class NotFoundError(OjasError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Resource not found"


class ConflictError(OjasError):
    status_code = status.HTTP_409_CONFLICT
    detail = "Resource already exists"


class ForbiddenError(OjasError):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "Access denied"


class UnauthorizedError(OjasError):
    status_code = status.HTTP_401_UNAUTHORIZED
    detail = "Authentication required"


class ValidationError(OjasError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    detail = "Validation failed"


class ConsentRequiredError(OjasError):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "Patient consent is required before AI processing"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(OjasError)
    async def ojas_error_handler(request: Request, exc: OjasError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail, "error_type": type(exc).__name__},
        )
