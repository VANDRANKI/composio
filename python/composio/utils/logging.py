"""
Logging utilities.
"""

import logging
import os
import typing as t
from enum import Enum

ENV_COMPOSIO_LOGGING_LEVEL = "COMPOSIO_LOGGING_LEVEL"

_DEFAULT_FORMAT = "[%(asctime)s][%(levelname)s] %(message)s"
_DEFAULT_LOGGER_NAME = "composio"

_LOG_VERBOSITY = int(os.environ.get("COMPOSIO_LOG_VERBOSITY", 0))
_LOG_LINE_SIZE_BY_VERBOSITY = {
    0: 256,
    1: 512,
    2: 1024,
    3: -1,
}

_logger: t.Optional[logging.Logger] = None
"""Global logger object for composio."""

_logger_wrapper: t.Optional["_VerbosityWrapper"] = None
"""Global logger object wrapped with verbosity setting for composio."""


class LogLevel(Enum):
    """Logging level."""

    CRITICAL = "critical"
    FATAL = "fatal"
    ERROR = "error"
    WARNING = "warning"
    WARN = "warn"
    INFO = "info"
    DEBUG = "debug"
    NOTSET = "notset"


_LEVELS: t.Dict[LogLevel, int] = {
    LogLevel.CRITICAL: logging.CRITICAL,
    LogLevel.FATAL: logging.FATAL,
    LogLevel.ERROR: logging.ERROR,
    LogLevel.WARNING: logging.WARNING,
    LogLevel.WARN: logging.WARN,
    LogLevel.INFO: logging.INFO,
    LogLevel.DEBUG: logging.DEBUG,
    LogLevel.NOTSET: logging.NOTSET,
}


class _VerbosityWrapper:
    """Thin wrapper around :class:`logging.Logger` that truncates long messages.

    Long log lines (e.g. raw API responses) can drown out useful output in a
    terminal. This wrapper caps each message at a configurable number of
    characters depending on ``COMPOSIO_LOG_VERBOSITY``:

    - ``0`` (default) – 256 characters
    - ``1``            – 512 characters
    - ``2``            – 1 024 characters
    - ``3``            – unlimited

    Error-level messages are *never* truncated because losing part of an
    error message can make diagnosis impossible.
    """

    def __init__(
        self,
        logger: logging.Logger,
        verbosity_level: t.Optional[int] = None,
    ) -> None:
        """Wrap *logger* and configure truncation for the given verbosity level.

        :param logger: The underlying :class:`logging.Logger` to delegate to.
        :param verbosity_level: Override for ``COMPOSIO_LOG_VERBOSITY``.
                                When ``None``, the environment variable value is used.
        """
        self.logger = logger
        self.level = logger.level
        self.setup(verbosity_level=verbosity_level)
        self.verbosity = min(verbosity_level or _LOG_VERBOSITY, 3)
        self.size = _LOG_LINE_SIZE_BY_VERBOSITY[self.verbosity]

    def setup(self, verbosity_level: t.Optional[int] = None) -> None:
        """Update the truncation settings for a new verbosity level.

        This may be called after construction to change the verbosity without
        creating a new wrapper instance.

        :param verbosity_level: New verbosity level (0–3). ``None`` is a no-op.
        """
        if verbosity_level is None:
            return
        self.verbosity = verbosity_level
        self.size = _LOG_LINE_SIZE_BY_VERBOSITY[self.verbosity]

    def _trim(self, msg: object) -> str:
        """Truncate *msg* to the configured line-size limit.

        If the message length is within the limit, or if the limit is -1
        (unlimited verbosity), the original string is returned unchanged.
        Otherwise, the message is sliced and an ellipsis (``...``) is appended
        so callers know content was cut.

        :param msg: The log message (any type; converted to ``str`` first).
        :returns: Possibly-truncated string representation of *msg*.
        """
        msg = str(msg)
        if self.size == -1:
            return msg

        if len(msg) < self.size:
            return msg

        return msg[: self.size] + "..."

    def info(self, msg: object, *args: t.Any, **kwargs: t.Any) -> None:
        """Log *msg* at INFO level, truncated to the current verbosity limit."""
        self.logger.info(self._trim(msg), *args, **kwargs)

    def debug(self, msg: object, *args: t.Any, **kwargs: t.Any) -> None:
        """Log *msg* at DEBUG level, truncated to the current verbosity limit."""
        self.logger.debug(self._trim(msg), *args, **kwargs)

    def warning(self, msg: object, *args: t.Any, **kwargs: t.Any) -> None:
        """Log *msg* at WARNING level, truncated to the current verbosity limit."""
        self.logger.warning(self._trim(msg), *args, **kwargs)

    def error(self, msg: object, *args: t.Any, **kwargs: t.Any) -> None:
        """Log *msg* at ERROR level.

        Unlike the other log methods, error messages are **not** truncated so
        that diagnostic information (stack traces, full error bodies) is always
        visible regardless of the current verbosity setting.
        """
        self.logger.error(msg, *args, **kwargs)

    def isEnabledFor(self, level: int) -> bool:
        """Return ``True`` if a message at *level* would be processed.

        Delegates directly to the underlying :class:`logging.Logger`.

        :param level: Numeric logging level (e.g. ``logging.DEBUG``).
        """
        return self.logger.isEnabledFor(level=level)


def _parse_log_level_from_env(default: int) -> int:
    """Parse log level from the ``COMPOSIO_LOGGING_LEVEL`` environment variable.

    Accepts case-insensitive values matching :class:`LogLevel` member names
    (e.g. ``"debug"``, ``"INFO"``, ``"Warning"``).
    Returns *default* if the variable is unset or contains an unrecognised value.

    :param default: Numeric logging level to use when the env var is absent or invalid.
    :returns: A numeric logging level suitable for :meth:`logging.Logger.setLevel`.
    """
    level = os.environ.get(ENV_COMPOSIO_LOGGING_LEVEL)
    if level is None:
        return default

    try:
        return _LEVELS[LogLevel(level.lower())]
    except (ValueError, KeyError):
        return default


def setup(level: LogLevel = LogLevel.INFO, log_format: str = _DEFAULT_FORMAT) -> None:
    """Setup logging config."""
    global _logger_wrapper
    if _logger_wrapper is None:
        _logger_wrapper = get(name=_DEFAULT_LOGGER_NAME)

    logging.basicConfig(format=log_format)
    _logger_wrapper.logger.setLevel(_LEVELS[level])


def get(
    name: t.Optional[str] = None,
    level: LogLevel = LogLevel.INFO,
    log_format: str = _DEFAULT_FORMAT,
    verbosity_level: t.Optional[int] = None,
) -> _VerbosityWrapper:
    """Set up the logger."""
    global _logger, _logger_wrapper
    if _logger_wrapper is not None:
        return t.cast(_VerbosityWrapper, _logger_wrapper)

    # Setup logging format.
    logging.basicConfig(format=log_format)

    # Create logger
    _logger = logging.getLogger(name or _DEFAULT_LOGGER_NAME)
    _logger.setLevel(_parse_log_level_from_env(default=_LEVELS[level]))
    _logger_wrapper = _VerbosityWrapper(_logger, verbosity_level=verbosity_level)
    return _logger_wrapper


class WithLogger:
    """Interface to endow subclasses with a logger."""

    def __init__(
        self,
        logger: t.Optional[logging.Logger] = None,
        logger_name: str = _DEFAULT_LOGGER_NAME,
        logging_level: LogLevel = LogLevel.INFO,
        verbosity_level: t.Optional[int] = None,
    ) -> None:
        """
        Initialize the logger.

        :param logger: the logger object.
        :param logger_name: the default logger name, if a logger is not provided.
        """
        self._logger = (
            _VerbosityWrapper(logger, verbosity_level=verbosity_level)
            if logger is not None
            else get(name=logger_name, level=logging_level)
        )
        self._logger.setup(verbosity_level=verbosity_level)
        self._logging_level = logging._levelToName[self._logger.level]

    @property
    def logger(self) -> logging.Logger:
        """Get the component logger."""
        return t.cast(logging.Logger, self._logger)
