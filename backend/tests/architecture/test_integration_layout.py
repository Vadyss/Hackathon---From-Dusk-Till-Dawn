from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]


def test_checkout_has_one_documentation_root_and_no_empty_backend_apps():
    docs = [p for p in ROOT.iterdir() if p.is_dir() and p.name.lower() == "docs"]
    assert len(docs) == 1
    assert (docs[0] / "kontrakt.md").is_file()
    for package in ("orchestrator", "gatekeeper"):
        assert not (ROOT / "backend" / package / "Dockerfile").exists()
        assert not (ROOT / "backend" / package / "requirements.txt").exists()
    assert not (ROOT / "backend/gatekeeper/main.py").exists()


def test_ci_keeps_all_test_suites_and_never_deletes_deployment_volumes():
    workflow = yaml.safe_load((ROOT / ".github/workflows/ci.yml").read_text())
    assert {"test", "frontend-test", "integration", "deploy"} <= workflow["jobs"].keys()
    suites = str(workflow["jobs"]["test"])
    assert "../sandbox/requirements.txt" in suites
    assert "../apify/llm-relay/tests" in suites
    deploy = str(workflow["jobs"]["deploy"])
    assert "down -v" not in deploy and "--volumes" not in deploy
    for check in ("APIFY_TOKEN", "http://1.1.1.1", "touch /app/test", "/health"):
        assert check in deploy
    assert "npm test" in str(workflow["jobs"]["frontend-test"])
    integration = str(workflow["jobs"]["integration"])
    assert "--base http://localhost:13000" in integration
    assert "--idle-before-run 180" in integration
