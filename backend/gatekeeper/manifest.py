"""Skill manifests and reusable parameter contracts."""
from __future__ import annotations

import math
import json
from copy import deepcopy
from .names import clip, valid_field, valid_name, violations_unique
from .policy import Policy
from .types import MissingSkill, Violation

PARAM_TYPES = {"string", "int", "float", "bool", "string[]", "string|string[]"}


def forbidden_param(name: str, policy: Policy) -> bool:
    return any(part in name.lower() for part in policy.skills.forbidden_param_patterns)


def matches_type(value: object, kind: str) -> bool:
    if kind == "string":
        return isinstance(value, str)
    if kind == "int":
        return type(value) is int
    if kind == "float":
        return type(value) is int or type(value) is float and math.isfinite(value)
    if kind == "bool":
        return type(value) is bool
    if kind == "string[]":
        return isinstance(value, list) and all(isinstance(v, str) for v in value)
    if kind == "string|string[]":
        return isinstance(value, str) or matches_type(value, "string[]")
    return False


def validate_spec(spec: object, role: str, policy: Policy) -> list[Violation]:
    errors = []
    def add(code, detail):
        errors.append(Violation(code=code, detail=detail))
    if not isinstance(spec, dict):
        return [Violation(code="INVALID_SPEC", detail="Chybí objekt specifikace dovednosti.")]
    try:
        json.dumps(spec, ensure_ascii=False, allow_nan=False).encode("utf-8")
    except (ValueError, TypeError, RecursionError):
        return [Violation(code="INVALID_SPEC", detail="Specifikace nemá platný formát JSON UTF-8.")]
    outputs = spec.get("outputs")
    if not isinstance(outputs, list) or not outputs or not all(valid_field(v) for v in outputs) or len(set(outputs)) != len(outputs):
        add("INVALID_SPEC", "Specifikace musí mít neprázdné jedinečné výstupy.")
    if spec.get("inputs") != ("lines" if role == "parser" else "events"):
        add("INVALID_SPEC", "Vstup specifikace neodpovídá druhu dovednosti.")
    params = spec.get("params")
    if not isinstance(params, dict):
        add("INVALID_SPEC", "Parametry specifikace musí být objekt.")
    else:
        for name, typ in params.items():
            if not valid_field(name) or not isinstance(typ, str) or typ not in PARAM_TYPES:
                add("INVALID_SPEC", f"Neplatný parametr specifikace: {name}.")
            if isinstance(name, str) and forbidden_param(name, policy):
                add("FORBIDDEN_PARAM", f"Zakázaný parametr: {name}.")
    return violations_unique(errors)


def validate_manifest(raw: object, spec: MissingSkill | None, policy: Policy) -> tuple[dict | None, list[Violation]]:
    errors = []
    def add(code, detail):
        errors.append(Violation(code=code, detail=detail))
    if not isinstance(raw, dict):
        return None, [Violation(code="INVALID_MANIFEST", detail="Manifest musí být objekt.")]
    try:
        json.dumps(raw, ensure_ascii=False, allow_nan=False).encode("utf-8")
    except (ValueError, TypeError, RecursionError):
        return None, [Violation(code="INVALID_MANIFEST", detail="Manifest nemá platný formát JSON UTF-8.")]
    required = {"name", "version", "kind", "description", "entrypoint", "inputs", "outputs", "params", "imports", "permissions"}
    if not required <= raw.keys() or raw.keys() - required - {"log_sources"}:
        add("INVALID_MANIFEST", "Manifest má chybějící nebo neznámá pole.")
    name, kind = raw.get("name"), raw.get("kind")
    if not valid_name(name):
        add("INVALID_NAME", "Neplatný název dovednosti.")
    if spec is not None and name != spec.name:
        add("INVALID_MANIFEST", "Název manifestu neodpovídá plánu.")
    if kind not in policy.skills.allowed_kinds or (spec is not None and kind != spec.role):
        add("KIND_MISMATCH", "Druh manifestu neodpovídá plánu.")
    if type(raw.get("version")) is not int or raw.get("version") != 1 or raw.get("entrypoint") != "run":
        add("INVALID_MANIFEST", "První verze musí být 1 a vstupní bod run.")
    if raw.get("inputs") != ("lines" if kind == "parser" else "events"):
        add("INVALID_MANIFEST", "Vstupy neodpovídají druhu dovednosti.")
    outputs = raw.get("outputs")
    if not isinstance(outputs, list) or not outputs or not all(valid_field(v) for v in outputs) or len(set(outputs)) != len(outputs):
        add("INVALID_MANIFEST", "Výstupy musí být neprázdný seznam identifikátorů.")
    elif spec is not None and not set(spec.spec.get("outputs", [])) <= set(outputs):
        add("INVALID_MANIFEST", "Manifest neobsahuje všechny požadované výstupy.")
    if not isinstance(raw.get("description"), str):
        add("INVALID_MANIFEST", "Popis musí být řetězec.")
    if kind == "parser" and (not isinstance(raw.get("log_sources"), list) or not raw["log_sources"] or not all(valid_field(v) for v in raw["log_sources"])):
        add("INVALID_MANIFEST", "Parser musí uvést zdroje logů.")
    params = raw.get("params")
    if not isinstance(params, dict):
        add("INVALID_MANIFEST", "Parametry manifestu musí být objekt.")
    else:
        for key, schema in params.items():
            if isinstance(key, str) and forbidden_param(key, policy):
                add("FORBIDDEN_PARAM", f"Zakázaný parametr: {key}.")
            if not valid_field(key) or not isinstance(schema, dict) or schema.keys() - {"type", "required", "default", "min", "max"} or (not isinstance(schema.get("type"), str) or schema.get("type") not in PARAM_TYPES) or type(schema.get("required")) is not bool:
                add("INVALID_MANIFEST", f"Neplatné schéma parametru: {key}.")
                continue
            typ = schema["type"]
            if "default" in schema and not matches_type(schema["default"], typ):
                add("INVALID_MANIFEST", f"Výchozí hodnota parametru {key} má chybný typ.")
            bounds = [schema[b] for b in ("min", "max") if b in schema]
            if bounds and (typ not in {"int", "float"} or any(type(b) not in (int, float) or type(b) is float and not math.isfinite(b) for b in bounds)):
                add("INVALID_MANIFEST", f"Neplatný rozsah parametru: {key}.")
            elif "min" in schema and "max" in schema and schema["min"] > schema["max"]:
                add("INVALID_MANIFEST", f"Obrácený rozsah parametru: {key}.")
            elif "default" in schema and matches_type(schema["default"], typ) and bounds and ("min" in schema and schema["default"] < schema["min"] or "max" in schema and schema["default"] > schema["max"]):
                add("INVALID_MANIFEST", f"Výchozí hodnota parametru {key} je mimo rozsah.")
        if spec is not None:
            for key, typ in spec.spec.get("params", {}).items():
                if key not in params or not isinstance(params[key], dict) or params[key].get("type") != typ:
                    add("INVALID_MANIFEST", f"Parametr neodpovídá specifikaci: {key}.")
    imports = raw.get("imports")
    if not isinstance(imports, list) or not all(isinstance(v, str) for v in imports) or any(v not in policy.skills.allowed_imports for v in imports):
        add("INVALID_MANIFEST", "Manifest obsahuje zakázané nebo neplatné importy.")
    permissions = raw.get("permissions")
    if not isinstance(permissions, dict) or set(permissions) != {"network", "filesystem", "subprocess"}:
        add("INVALID_MANIFEST", "Oprávnění musí výslovně zakázat síť, soubory a procesy.")
    else:
        if permissions["network"] is True:
            add("NETWORK_NOT_ALLOWED", "Síť není povolená.")
        if any(value is not False for value in permissions.values()):
            add("INVALID_MANIFEST", "Všechna oprávnění musí být false.")
    if errors:
        return None, violations_unique(errors)
    output = deepcopy(raw)
    output["description"] = clip(output["description"], 300)
    return output, []
