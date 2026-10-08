import pytest
from gatekeeper.static_analysis import analyze_code

BASE = 'def run(inputs, params):\n    return []\n'
HARMFUL = [
('import os\n' + BASE, 'FORBIDDEN_IMPORT'), ('import subprocess\n' + BASE, 'FORBIDDEN_IMPORT'),
('from os import system\n' + BASE, 'FORBIDDEN_IMPORT'), ('import socket\n' + BASE, 'FORBIDDEN_IMPORT'),
('import importlib\n' + BASE, 'FORBIDDEN_IMPORT'), ('import sys\n' + BASE, 'FORBIDDEN_IMPORT'),
('import ctypes\n' + BASE, 'FORBIDDEN_IMPORT'), ('import pickle\n' + BASE, 'FORBIDDEN_IMPORT'),
('import urllib.request\n' + BASE, 'FORBIDDEN_IMPORT'), ('import http.client\n' + BASE, 'FORBIDDEN_IMPORT'),
('from re import *\n' + BASE, 'FORBIDDEN_IMPORT'), ('from .re import escape\n' + BASE, 'FORBIDDEN_IMPORT'),
('def run(inputs, params):\n    import re\n    return []', 'FORBIDDEN_IMPORT'),
("def run(inputs, params):\n    return __import__('os')", 'FORBIDDEN_CALL'),
*[(f'def run(inputs, params):\n    return {call}(inputs)', 'FORBIDDEN_CALL') for call in ['eval', 'exec', 'compile', 'open', 'getattr', 'print', 'breakpoint', 'globals', 'setattr', 'memoryview']],
('def run(inputs, params):\n    return ().__class__.__bases__[0].__subclasses__()', 'FORBIDDEN_ATTRIBUTE'),
('def run(inputs, params):\n    return inputs.__dict__', 'FORBIDDEN_ATTRIBUTE'),
('def run(inputs, params):\n    return __builtins__', 'FORBIDDEN_ATTRIBUTE'),
('def run(inputs, params):\n    global state\n    return []', 'FORBIDDEN_SYNTAX'),
('async def run(inputs, params):\n    return []', 'FORBIDDEN_SYNTAX'),
('def run(inputs, params):\n    yield 1', 'FORBIDDEN_SYNTAX'),
('@decorator\n' + BASE, 'FORBIDDEN_SYNTAX'),
('class Evil(metaclass=meta):\n    pass\n' + BASE, 'FORBIDDEN_SYNTAX'),
('import re\ndef run(inputs, params):\n    del re\n    return []', 'FORBIDDEN_SYNTAX'),
('run([], {})\n' + BASE, 'FORBIDDEN_SYNTAX'),
('def another(inputs, params):\n    return []', 'MISSING_ENTRYPOINT'),
('def run(inputs):\n    return []', 'MISSING_ENTRYPOINT'),
('def run(inputs, params, **kwargs):\n    return []', 'MISSING_ENTRYPOINT'),
('def run(', 'SYNTAX_ERROR'),
('class Attack:\n    value = sum(range(10))\n' + BASE, 'FORBIDDEN_SYNTAX'),
('def helper(x=sum(range(10))):\n    return x\n' + BASE, 'FORBIDDEN_SYNTAX'),
('def helper(x: sum(range(10))):\n    return x\n' + BASE, 'FORBIDDEN_SYNTAX'),
('def run(inputs, params):\n    return dataclasses.builtins.open("file")', 'FORBIDDEN_CALL'),
('A = ' + repr('a' * 2001) + '\n' + BASE, 'CODE_TOO_LARGE'),
('A = ' + repr('a' * 21000) + '\n' + BASE, 'CODE_TOO_LARGE'),
('def run(inputs, params):\n' + '\n'.join('    value = 1' for _ in range(1600)) + '\n    return []', 'CODE_TOO_LARGE'),
]

@pytest.mark.parametrize('source,code', HARMFUL)
def test_harmful(source, code, gk_policy):
    assert code in {v.code for v in analyze_code(source, {'imports': ['re']}, gk_policy)}

@pytest.mark.parametrize('source', [BASE, 'import re\nP = re.compile("abc")\n' + BASE, 'from collections import defaultdict\n' + BASE, 'VALUES = frozenset((1, 2))\n' + BASE, 'class Helper:\n    def __init__(self):\n        self.value = 0\n' + BASE, 'def run(inputs, params):\n    return [{"_line": i} for i, value in enumerate(inputs)]'])
def test_legitimate(source, gk_policy):
    assert not analyze_code(source, {'imports': ['re', 'collections']}, gk_policy)

def test_undeclared_and_tests(gk_policy):
    assert analyze_code('import re\n' + BASE, {'imports': []}, gk_policy)[0].code == 'UNDECLARED_IMPORT'
    assert not analyze_code('from skill import run\ndef test_empty():\n    assert run([], {}) == []', {'imports': []}, gk_policy, is_test=True)
    assert analyze_code('import os\ndef test_empty():\n    pass', {'imports': []}, gk_policy, is_test=True)
