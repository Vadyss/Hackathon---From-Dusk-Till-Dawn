"""Public boundary: proposals in, deterministic verdicts out."""
from __future__ import annotations

import asyncio
from copy import deepcopy

from .audit import AuditLog
from .datasets import DatasetStore
from .evaluator import evaluate_recipe
from .hidden_tests import run_hidden_tests
from .lessons import Lessons
from .manifest import validate_manifest
from .names import require_run_id, violations_unique
from .plan_check import check_plan
from .policy import load_policy
from .recipe import check_recipe, display_recipe
from .registry import IntegrityError, Registry, recipe_sha256
from .sandbox_client import SandboxClient
from .static_analysis import analyze_code
from .types import GatekeeperConfig, ParseFailure, SkillVerdict, Violation


class Gatekeeper:
    def __init__(self, cfg: GatekeeperConfig, sandbox, examiner=None):
        self.policy = load_policy(cfg.policy_path)
        self.datasets = DatasetStore(cfg.datasets_dir, self.policy.datasets.min_instances_per_attack_type,
                                     self.policy.datasets.sample_lines)
        self.sandbox = sandbox
        self.audit = AuditLog(cfg.data_dir)
        self.registry = Registry(cfg.data_dir, self.audit)
        self.registry.initialize(cfg.seed_skills_dir)
        self._lessons = Lessons(cfg.data_dir)
        self._plans = {}
        self._checked = {}
        self._tuning = {}
        self._validated = {}
        self._validation_started = set()
        self._last_recipes = {}
        self._skill_attempts = {}
        self.examiner = examiner
        self.examiner_enabled = cfg.examiner_enabled
        self.audit.append("startup", detail={"policy_sha256": self.policy.sha256,
                                             "datasets_manifest_sha256": self.datasets.manifest_sha256,
                                             "datasets": self.datasets.digests})

    @property
    def max_llm_calls(self):
        return self.policy.llm.max_calls_per_run

    def catalog(self):
        return {**self.datasets.catalog(), "skills": self.registry.manifests(),
                "policy": self.policy.digest_for_llm()}

    def log_sample(self, source):
        return self.datasets.sample(source)

    def lessons(self, limit=5, attack_type=None):
        return self._lessons.read(limit, attack_type)

    def approved_rule(self, attack_type):
        return self.registry.approved_rule(attack_type)

    def skill_info(self, name):
        return self.registry.skill_info(name)

    def installed_skills(self):
        return self.registry.installed_skills()

    def candidates_info(self, run_id):
        return self.registry.candidate_infos(run_id)

    def check_plan(self, run_id, raw):
        require_run_id(run_id)
        verdict = check_plan(raw, self.catalog(), self.policy)
        if verdict.ok:
            self._plans[run_id] = deepcopy(verdict.plan)
        elif verdict.request_rejected:
            self.audit.append("request_rejected", run_id, {"reason": verdict.reason})
        else:
            self.audit.append("plan_rejected", run_id, {"violations": [v.model_dump() for v in verdict.violations]})
        return verdict

    async def submit_skill(self, run_id, spec, draft):
        spec, draft = deepcopy(spec), deepcopy(draft)
        require_run_id(run_id)
        plan = self._plans.get(run_id)
        if plan is None or not any(s.model_dump() == spec.model_dump() for s in plan.missing_skills):
            raise IntegrityError("Dovednost neodpovídá schválenému plánu.")
        key = (run_id, spec.name)
        self._skill_attempts[key] = self._skill_attempts.get(key, 0) + 1
        if self._skill_attempts[key] > self.policy.attempts.forge_per_skill:
            raise IntegrityError("Překročen počet pokusů kovárny.")
        violations = []
        if (not isinstance(draft, dict) or not isinstance(draft.get("code"), str)
                or not isinstance(draft.get("tests"), str) or not isinstance(draft.get("manifest"), dict)):
            violations = [Violation(code="INVALID_OUTPUT", detail="Kovárna musí vrátit manifest, kód a testy.")]
            manifest = None
        else:
            manifest, violations = validate_manifest(draft["manifest"], spec, self.policy)
            # Analyze even invalid manifests to report all safe-to-compute violations.
            declared = manifest or {"imports": []}
            violations += analyze_code(draft["code"], declared, self.policy)
            violations += analyze_code(draft["tests"], declared, self.policy, is_test=True)
        violations = violations_unique(violations)
        if violations:
            self.audit.append("skill_rejected", run_id, {"skill": spec.name,
                              "attempt": self._skill_attempts[key], "violations": [v.model_dump() for v in violations]})
            return SkillVerdict(kind="policy_rejected", violations=violations)
        result = await self.sandbox.test(draft["code"], draft["tests"],
                                         allowed_imports=list(self.policy.skills.allowed_imports),
                                         timeout_s=self.policy.sandbox.test_timeout_s)
        report = result["tests"]
        total = report["total"]
        failed = report["failed"]
        failures = report["failures"].copy()
        if result["status"] != "ok" and failed == 0:
            failed += 1
            total += 1
            failures.append({"name": "execution", "error": "Překročen časový limit." if result["status"] == "timeout" else "Testy dovednosti selhaly."})
        if report["total"] < self.policy.skills.min_llm_tests:
            total += 1
            failed += 1
            failures.append({"name": "test_count", "error": "Dovednost obsahuje málo testů."})
        hidden_total, hidden_failures = await run_hidden_tests(manifest, draft["code"], self.sandbox, self.policy,
             parser_lines=self.datasets.parser_lines(plan.log_source) if spec.role == "parser" else None)
        total += hidden_total
        failed += len(hidden_failures)
        failures.extend(hidden_failures)
        if failed:
            self.audit.append("skill_tests_failed", run_id, {"skill": spec.name, "attempt": self._skill_attempts[key],
                                                            "tests_total": total, "tests_failed": failed})
            return SkillVerdict(kind="tests_failed", tests_total=total, tests_failed=failed,
                                failures=failures[:5], error_excerpt=failures[0]["error"][:500] if failures else "Testy selhaly.")
        info = self.registry.save_candidate(run_id, manifest, draft["code"], draft["tests"], self._skill_attempts[key])
        meta = self.registry.read_skill(run_id, spec.name)[2]
        return SkillVerdict(kind="candidate", skill_info=info, manifest=manifest, tests_total=total,
                            code_sha256=meta["sha256"])

    def display_recipe(self, raw):
        return display_recipe(raw)

    def check_recipe(self, run_id, plan, raw):
        require_run_id(run_id)
        stored = self._plans.get(run_id)
        if stored is None or stored.model_dump() != plan.model_dump():
            raise IntegrityError("Recept neodpovídá schválenému plánu.")
        manifests = {m["name"]: m for m in self.registry.manifests(run_id)}
        verdict = check_recipe(raw, stored, manifests, self.policy)
        if verdict.ok:
            self._checked[run_id] = recipe_sha256(verdict.recipe)
            self._last_recipes[run_id] = deepcopy(verdict.recipe)
        else:
            self.audit.append("recipe_rejected", run_id, {"violations": [v.model_dump() for v in verdict.violations]})
        return verdict

    def _skill_digests(self, run_id, recipe):
        names = [recipe["parser"], recipe["aggregation"]["skill"]] + [s["skill"] for s in recipe.get("enrich", [])]
        return {name: self.registry.read_skill(run_id, name)[2]["sha256"] for name in names}

    async def evaluate_tuning(self, run_id, recipe):
        recipe = deepcopy(recipe)
        require_run_id(run_id)
        if self._checked.get(run_id) != recipe_sha256(recipe):
            raise IntegrityError("Recept neprošel kontrolou vrátného.")
        plan = self._plans[run_id]
        data = self.datasets.load(plan.log_source, "tuning")
        digests = self._skill_digests(run_id, recipe)
        result = await evaluate_recipe(recipe, data.lines, data.labels, lambda name: self.registry.read_skill(run_id, name),
                                       self.sandbox, self.policy, feedback=True, audit=self.audit, run_id=run_id)
        if digests != self._skill_digests(run_id, recipe):
            raise IntegrityError("Dovednost se během měření změnila.")
        self._tuning[run_id] = {"recipe_sha256": recipe_sha256(recipe), "metrics": result.metrics,
                               "skill_digests": digests}
        self.audit.append("rule_evaluated", run_id, {"dataset": "tuning", "metrics": result.metrics.model_dump(mode="json"),
                                                    "cross_type_hits": result.cross_type_hits})
        return result

    async def evaluate_validation(self, run_id, recipe):
        recipe = deepcopy(recipe)
        require_run_id(run_id)
        tuning = self._tuning.get(run_id)
        if (not tuning or not tuning["metrics"].passed or tuning["recipe_sha256"] != recipe_sha256(recipe)
                or run_id in self._validation_started):
            raise IntegrityError("Ověření vyžaduje úspěšné ladění; lze ho provést jen jednou.")
        digests = self._skill_digests(run_id, recipe)
        if digests != tuning["skill_digests"]:
            raise IntegrityError("Dovednost se od ladění změnila.")
        self._validation_started.add(run_id)
        plan = self._plans[run_id]
        data = self.datasets.load(plan.log_source, "validation")
        result = await evaluate_recipe(recipe, data.lines, data.labels, lambda name: self.registry.read_skill(run_id, name),
                                       self.sandbox, self.policy, audit=self.audit, run_id=run_id)
        if digests != self._skill_digests(run_id, recipe):
            raise IntegrityError("Dovednost se během ověření změnila.")
        self._validated[run_id] = {"recipe_sha256": recipe_sha256(recipe), "attack_type": plan.attack_type,
                                 "metrics_tuning": tuning["metrics"], "metrics_validation": result.metrics,
                                 "skill_digests": digests}
        self.audit.append("validation_done", run_id, {"metrics": result.metrics.model_dump(mode="json"),
                                                     "cross_type_hits": result.cross_type_hits})
        return result.metrics

    def note_reuse(self, run_id, names):
        self.registry.note_reuse(run_id, names)

    async def promote(self, run_id, recipe, new_skills, comment):
        recipe, new_skills = deepcopy(recipe), deepcopy(new_skills)
        result = await asyncio.to_thread(self.registry.promote, run_id, recipe, new_skills,
                                         deepcopy(self._validated.get(run_id, {})), comment)
        self._forget(run_id)
        return result

    def record_rejection(self, run_id, recipe, attack_type, reason):
        require_run_id(run_id)
        self.audit.append("rule_rejected", run_id, {"reason": reason, "attack_type": attack_type})
        self._lessons.record(run_id, attack_type, "analyst_rejected", reason, recipe)

    def record_failure(self, run_id, reason_code, reason, recipe=None):
        self.audit.append("run_failed", run_id, {"reason_code": reason_code, "reason": reason})
        if reason_code in {"RULE_FAILED", "VALIDATION_FAILED"}:
            plan = self._plans.get(run_id)
            tuning = self._tuning.get(run_id, {}).get("metrics")
            validation = self._validated.get(run_id, {}).get("metrics_validation")
            metric_text = ""
            for label, metrics in (("Ladění", tuning), ("Ověření", validation)):
                if metrics:
                    metric_text += f" {label}: precision={metrics.precision}, recall={metrics.recall}."
            self._lessons.record(run_id, plan.attack_type if plan else "unknown", reason_code,
                                 reason + metric_text, self._last_recipes.get(run_id))

    def _forget(self, run_id):
        for state in (self._plans, self._checked, self._tuning, self._validated, self._last_recipes):
            state.pop(run_id, None)
        self._validation_started.discard(run_id)
        self._skill_attempts = {k: v for k, v in self._skill_attempts.items() if k[0] != run_id}

    async def discard(self, run_id):
        await asyncio.to_thread(self.registry.discard, run_id)
        self._forget(run_id)
