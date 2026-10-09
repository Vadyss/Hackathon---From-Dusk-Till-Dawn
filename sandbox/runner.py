# Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved.
"""Disposable child process; trusted runtime is separate from skill namespaces."""
from __future__ import annotations

import ast
import builtins
import contextlib
import datetime
import dis
import importlib
import json
import os
from pathlib import Path
import re
import sys
import types
from typing import Any

MAX_OUTPUT_BYTES = 10_000_000
_ORIGINAL_OPEN = builtins.open
_ORIGINAL_IMPORT = builtins.__import__
_SOURCES: frozenset[str] = frozenset()


class DiscardOutput:
    """Discard writes without retaining attacker-controlled text in memory."""
    def write(self, value: str) -> int:
        return len(value)

    def flush(self) -> None:
        pass


def _skill_on_stack() -> bool:
    frame = sys._getframe(1)
    while frame is not None:
        if frame.f_code.co_filename in _SOURCES:
            return True
        frame = frame.f_back
    return False


def _audit(event: str, args: tuple[Any, ...]) -> None:
    # This also blocks I/O reached through standard-library aliases. Hooks are
    # installed once and cannot be removed by submitted code.
    forbidden = (event in {"open", "exec", "compile"} or event.startswith(("socket.", "subprocess.", "ctypes."))
                 or event in {"os.system", "os.fork", "os.forkpty", "os.posix_spawn", "os.exec",
                              "os.spawn", "os.remove", "os.rmdir", "os.rename", "os.mkdir", "os.chdir",
                              "os.listdir", "os.scandir", "os.chmod", "os.chown", "os.link", "os.symlink"})
    if forbidden and _skill_on_stack():
        raise PermissionError("Sandbox nepovoluje soubory, síť ani podprocesy.")


def _error(exc: BaseException, limit: int = 2000) -> str:
    message = f"{type(exc).__name__}: {exc}"
    # User-raised exceptions may contain absolute paths; do not export them.
    message = re.sub(r"(?<!\w)/(?:[^\s'\"<>:]+/?)+", "[cesta]", message)
    return "".join(c for c in message if ord(c) >= 32 or c in "\n\t")[:limit]


def _runtime_ast_check(source: str, filename: str) -> ast.Module:
    tree = ast.parse(source, filename)
    # Import/open hooks remain active even when callers bypass the gatekeeper.
    # Deny introspection that could reach this trusted runner or its globals.
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
            raise PermissionError("Sandbox nepovoluje introspekci atributů.")
        if isinstance(node, ast.Name) and node.id.startswith("__"):
            raise PermissionError("Sandbox nepovoluje introspekci jmen.")
    return tree


def _load_module(name: str, workdir: Path, safe_builtins: dict[str, Any]) -> types.ModuleType:
    filename = str(workdir / f"{name}.py")
    with _ORIGINAL_OPEN(filename, encoding="utf-8") as file:
        tree = _runtime_ast_check(file.read(), filename)
    module = types.ModuleType(name)
    module.__dict__["__builtins__"] = safe_builtins
    module.__dict__["__file__"] = filename
    sys.modules[name] = module
    exec(compile(tree, filename, "exec"), module.__dict__)
    return module


def run_job(workdir: Path) -> dict[str, Any]:
    global _SOURCES
    with _ORIGINAL_OPEN(workdir / "input.json", encoding="utf-8") as file:
        job = json.load(file)
    _SOURCES = frozenset(str(workdir / name) for name in ("skill.py", "test_skill.py"))
    allowed = frozenset(job.get("allowed_imports", []))
    # Preload and warm lazy imports before the I/O guard is installed.
    for name in allowed:
        importlib.import_module(name)
    datetime.datetime.strptime("2026-10-08", "%Y-%m-%d")
    datetime.datetime.fromisoformat("2026-10-08T00:00:00+02:00").timestamp()

    # Standard modules sometimes expose sys/os as implementation details.
    # A facade prevents those objects from becoming a route around the hooks.
    views: dict[str, types.ModuleType] = {}

    class ModuleView(types.ModuleType):
        def __getattribute__(self, name: str) -> Any:
            if name.startswith("_"):
                raise PermissionError("Sandbox nepovoluje soukromé atributy modulů.")
            value = getattr(sys.modules[types.ModuleType.__getattribute__(self, "__name__")], name)
            if isinstance(value, types.ModuleType):
                if value.__name__ not in allowed:
                    raise PermissionError("Sandbox nepovoluje přístup k interním modulům.")
                return module_view(value)
            if types.ModuleType.__getattribute__(self, "__name__") == "operator" and name in {"attrgetter", "methodcaller"}:
                def guarded_factory(*args: Any, **kwargs: Any) -> Any:
                    selectors = args if name == "attrgetter" else args[:1]
                    if any(not isinstance(selector, str) or any(part.startswith("_") for part in selector.split("."))
                           for selector in selectors):
                        raise PermissionError("Sandbox nepovoluje soukromé atributy.")
                    return value(*args, **kwargs)
                return guarded_factory
            return value

    def module_view(module: types.ModuleType) -> types.ModuleType:
        if module.__name__ not in views:
            views[module.__name__] = ModuleView(module.__name__)
        return views[module.__name__]

    def import_guard(name: str, globals: dict[str, Any] | None = None,
                     locals: dict[str, Any] | None = None, fromlist: tuple = (), level: int = 0) -> Any:
        caller = (globals or {}).get("__name__", "")
        if caller in {"skill", "test_skill"}:
            # datetime's C implementation calls __import__ with the skill's
            # globals even after _strptime was warmed. Permit that cached C
            # dependency, while an explicit IMPORT_NAME remains forbidden.
            frame = sys._getframe(1)
            if (name == "_strptime" and "datetime" in allowed and name in sys.modules
                    and not level and frame.f_code.co_code[frame.f_lasti] != dis.opmap["IMPORT_NAME"]):
                return sys.modules[name]
            if level or name not in allowed and not (name == "skill" and caller == "test_skill"):
                raise ImportError(f"Zakázaný import: {name}.")
            if name in allowed:
                return module_view(sys.modules[name])
        return _ORIGINAL_IMPORT(name, globals, locals, fromlist, level)

    def open_guard(*args: Any, **kwargs: Any) -> Any:
        if _skill_on_stack():
            raise PermissionError("Sandbox nepovoluje přístup k souborům.")
        return _ORIGINAL_OPEN(*args, **kwargs)

    builtins.__import__ = import_guard
    builtins.open = open_guard
    safe = dict(builtins.__dict__)
    for name in ("eval", "exec", "compile", "input", "breakpoint", "globals", "locals", "vars",
                 "getattr", "setattr", "delattr", "dir", "help", "exit", "quit", "memoryview"):
        safe.pop(name, None)
    sys.addaudithook(_audit)
    answer = {"status": "ok", "result": None,
              "tests": {"total": 0, "failed": 0, "failures": []}, "error": None, "duration_ms": 0}
    try:
        with contextlib.redirect_stdout(DiscardOutput()), contextlib.redirect_stderr(DiscardOutput()):
            skill = _load_module("skill", workdir, safe)
            if job["mode"] == "run":
                answer["result"] = skill.run(job.get("inputs", []), job.get("params", {}))
                if not isinstance(answer["result"], list):
                    raise TypeError("Výstup dovednosti musí být seznam.")
            else:
                tests = _load_module("test_skill", workdir, safe)
                for name, function in list(tests.__dict__.items()):
                    if (not name.startswith("test_") or not isinstance(function, types.FunctionType)
                            or function.__module__ != "test_skill"):
                        continue
                    answer["tests"]["total"] += 1
                    try:
                        function()
                    except BaseException as exc:
                        answer["tests"]["failed"] += 1
                        if len(answer["tests"]["failures"]) < 100:
                            answer["tests"]["failures"].append({"name": name[:200], "error": _error(exc, 500)})
            encoded = json.dumps(answer, ensure_ascii=False, allow_nan=False).encode("utf-8")
            if len(encoded) > MAX_OUTPUT_BYTES:
                raise ValueError("Výstup překračuje limit 10 MB.")
    except BaseException as exc:
        answer["status"] = "error"
        answer["result"] = None
        answer["error"] = _error(exc)
    return answer


def main() -> None:
    # CPython may add LC_CTYPE when it starts; no secret-bearing inherited env
    # survives. The executed skill sees exactly the explicitly supplied PATH.
    path = os.environ.get("PATH", os.defpath)
    os.environ.clear()
    os.environ["PATH"] = path
    workdir = Path(sys.argv[1]).resolve()
    answer = run_job(workdir)
    with _ORIGINAL_OPEN(workdir / "result.json", "w", encoding="utf-8") as file:
        json.dump(answer, file, ensure_ascii=False, allow_nan=False)


if __name__ == "__main__":
    main()
