import functools
import typing as t

from .uuid import generate_short_id, generate_uuid


class DeprecationError(Exception):
    """Raised when deprecating some older functions. This is strictly for use
    while developing and will be removed from the codebase later."""

    pass


def deprecate(
    reason: str = "This function is deprecated",
) -> t.Callable[[t.Callable], t.Callable]:
    """Deprecation decorator. Provide `reason` to show why you're deprecating something.
    NOTE: Decorating something with this will ensure that the function _will not run._
    """

    def decorator(func: t.Callable) -> t.Callable:
        @functools.wraps(func)
        def wrapper(*args: t.Any, **kwargs: t.Any) -> t.NoReturn:
            raise DeprecationError(f"{func.__name__} is deprecated: `{reason}`")

        return wrapper

    return decorator


__all__ = [
    "DeprecationError",
    "deprecate",
    "generate_short_id",
    "generate_uuid",
]
