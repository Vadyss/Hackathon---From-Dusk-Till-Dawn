# Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved.
"""Verify translation scope against the exact starting main commit, without network."""
from __future__ import annotations
import ast
import hashlib
import json
from pathlib import Path
import subprocess

BASELINE = '0465cee'
ROOT = Path(__file__).resolve().parents[2]
checks = []

def original(path: Path) -> bytes:
    return subprocess.check_output(['git', 'show', f'{BASELINE}:{path.as_posix()}'], cwd=ROOT)

def check(name: str, proof: object) -> None:
    checks.append({'name': name, 'result': 'PASS', 'proof': proof})

class HumanStrings(ast.NodeTransformer):
    def visit_Constant(self, node):
        if isinstance(node.value, str):
            node.value = '<text>'
        return node

for path in sorted(Path('backend/gatekeeper').glob('*.py')):
    before = ast.dump(HumanStrings().visit(ast.parse(original(path))))
    after = ast.dump(HumanStrings().visit(ast.parse(path.read_bytes())))
    assert before == after, f'Gatekeeper logic changed: {path}'
check('gatekeeper_ast_only_text_values_changed', 'Every gatekeeper module matches starting main after normalizing string literals; identifiers, operators, branches, values and imports are unchanged.')

protected = subprocess.check_output(['git','ls-tree','-r','--name-only', BASELINE, '--', 'sandbox', 'backend/policy'], cwd=ROOT, text=True).splitlines()
protected += [str(path) for path in Path('backend/datasets').rglob('*') if path.is_file() and (path.suffix == '.log' or 'label' in path.name)]
for name in protected:
    path = Path(name)
    assert path.read_bytes() == original(path), f'Protected data or sandbox changed: {name}'
check('sandbox_policy_logs_labels_byte_identical', {'files': len(protected)})

for path in sorted(Path('backend/seed_skills').glob('*/skill.py')):
    before = ast.parse(original(path))
    after = ast.parse(path.read_bytes())
    for tree in (before, after):
        if tree.body and isinstance(tree.body[0], ast.Expr) and isinstance(tree.body[0].value, ast.Constant) and isinstance(tree.body[0].value.value, str):
            tree.body.pop(0)
    assert ast.dump(before) == ast.dump(after), f'Seed executable AST changed: {path}'
check('seed_executable_ast_identical', 'Only English module docstrings change source SHA and trigger the unchanged versioned seed upgrade.')

manifest = Path('backend/datasets/MANIFEST.sha256')
old_rows = dict(row.split(None, 1)[::-1] for row in original(manifest).decode().splitlines())
new_rows = dict(row.split(None, 1)[::-1] for row in manifest.read_text().splitlines())
assert set(old_rows) == set(new_rows)
changed = [name for name in old_rows if old_rows[name] != new_rows[name]]
assert changed == ['catalog.json'], changed
for name, digest in new_rows.items():
    assert hashlib.sha256((manifest.parent / name).read_bytes()).hexdigest() == digest
check('dataset_manifest_only_catalog_digest_changed', changed)

source = '\n'.join(p.read_text() for p in Path('frontend/src').rglob('*') if p.is_file() and p.suffix in {'.ts', '.tsx', '.css'})
assert not any(c in source for c in 'áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ')
assert 'en-GB' not in source and 'cs-CZ' not in source
assert 'eleven_multilingual_v2' in Path('backend/orchestrator/config.py').read_text()
assert 'cost_usd' in Path('Docs/kontrakt.md').read_text()
assert 'jsou anglicky' in Path('Docs/kontrakt.md').read_text()
check('frontend_source_locale_and_contract', 'No Czech application copy or old locale in frontend source; contract v1 English, provider cost and multilingual voice model retained.')

out = ROOT / 'Docs/integration/english_static.json'
out.write_text(json.dumps({'status':'PASS','baseline':BASELINE,'checks':checks}, indent=2) + '\n')
print(json.dumps({'status':'PASS','checks':len(checks)}))
