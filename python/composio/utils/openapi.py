"""OpenAPI helpers."""

import inspect
import typing as t

from composio.exceptions import InvalidSchemaError

OPENAPI_TO_PYTHON = {
    "null": None,
    "number": float,
    "integer": int,
    "boolean": bool,
    "string": str,
}


# pylint: disable=unused-argument
def _handle_object_type(schema: t.Dict) -> t.Type:
    """Convert an OpenAPI ``object`` schema to a Python type.

    Nested object properties are not supported yet, so this always
    resolves to a generic ``Dict[str, Any]``.
    """
    # Nested objects are not supported ATM
    return t.Dict[str, t.Any]


def _handle_array_type(schema: t.Dict) -> t.Any:
    """Convert an OpenAPI ``array`` schema to a ``List[...]`` type.

    Falls back to ``List[Any]`` when the array's ``items`` schema has
    no declared type. Nested object item schemas are discarded.
    """
    # This discards the nested objects
    items_type = schema.get("items", {}).get("type")
    if items_type is None:
        return t.List[t.Any]

    SubT = _type_to_parameter(schema=schema.get("items", {}))
    return t.List[SubT]  # type: ignore


def _handle_enum_type(schema: t.Dict) -> t.Any:
    """Convert an OpenAPI ``enum`` schema to a ``Literal[...]`` type."""
    return t.Literal[tuple(schema["enum"])]


def _type_to_parameter(schema: t.Dict[str, t.Any]) -> t.Any:
    """Resolve a single OpenAPI property schema to a Python type.

    Handles ``enum``, primitive types (via ``OPENAPI_TO_PYTHON``),
    ``object``, and ``array`` schemas.

    :raises InvalidSchemaError: If the schema's ``type`` is not recognized.
    """
    if "enum" in schema:
        return _handle_enum_type(schema=schema)

    p_type = schema["type"]
    if p_type in OPENAPI_TO_PYTHON:
        return OPENAPI_TO_PYTHON[p_type]

    if p_type == "object":
        return _handle_object_type(schema=schema)

    if p_type == "array":
        return _handle_array_type(schema=schema)

    raise InvalidSchemaError(f"Invalid property type {p_type}: {schema!r}")


def _handle_composite_type(schemas: t.List[t.Dict]) -> t.Any:
    """Convert a list of subschemas to a ``Union[...]`` of their types."""
    return t.Union[tuple(map(_type_to_parameter, schemas))]


def _one_of_to_parameter(schema: t.Dict[str, t.Any]) -> t.Any:
    """Convert an OpenAPI ``oneOf`` schema to a ``Union[...]`` type."""
    return _handle_composite_type(schemas=schema["oneOf"])


def _any_of_to_parameter(schema: t.Dict[str, t.Any]) -> t.Any:
    """Convert an OpenAPI ``anyOf`` schema to a ``Union[...]`` type."""
    return _handle_composite_type(schemas=schema["anyOf"])


def _all_of_to_parameter(schema: t.Dict[str, t.Any]) -> t.Type:
    """Convert an OpenAPI ``allOf`` schema to a Python type.

    Shallow-merges all subschemas into a single schema (later entries
    win on key conflicts) before resolving the merged result.
    """
    composite = {}
    for subschema in schema["allOf"]:
        composite.update(subschema)
    return _type_to_parameter(schema=composite)


def function_signature_from_jsonschema(
    schema: t.Dict[str, t.Any],
    skip_default: bool = False,
) -> t.List[inspect.Parameter]:
    """Convert json schema to a list of parameters (`inspect.Parameter`)."""
    parameters = []
    required = set(schema.get("required", []))
    for p_name, p_schema in schema.get("properties", {}).items():
        if "oneOf" in p_schema:
            p_type = _one_of_to_parameter(schema=p_schema)
        elif "anyOf" in p_schema:
            p_type = _any_of_to_parameter(schema=p_schema)
        elif "allOf" in p_schema:
            p_type = _all_of_to_parameter(schema=p_schema)
        elif "type" in p_schema:
            p_type = _type_to_parameter(schema=p_schema)
        else:
            # Handle cases where no type is specified (e.g., Pydantic's Any type)
            # This typically happens when using typing.Any in Pydantic models,
            # which intentionally omits the 'type' field in JSON schema
            p_type = t.Any

        p_val = p_schema.get("default", None)
        if p_name in required or p_schema.get("required", False) or skip_default:
            p_val = inspect.Parameter.empty

        parameters.append(
            inspect.Parameter(
                name=p_name,
                annotation=p_type,
                default=p_val,
                kind=inspect.Parameter.POSITIONAL_OR_KEYWORD,
            )
        )

    return parameters
