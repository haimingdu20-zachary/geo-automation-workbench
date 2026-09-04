from __future__ import annotations

import json
import unittest

from app.server import PROJECT_ROOT, STATIC_ROOT, WorkflowRunner


class WorkflowRunnerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        sample_path = PROJECT_ROOT / "skills" / "doubao-geo-publisher" / "assets" / "client_profile.template.json"
        cls.profile = json.loads(sample_path.read_text(encoding="utf-8"))
        cls.runner = WorkflowRunner()

    def test_static_shell_exists(self) -> None:
        self.assertTrue((STATIC_ROOT / "index.html").is_file())
        self.assertTrue((STATIC_ROOT / "app.js").is_file())
        self.assertTrue((STATIC_ROOT / "styles.css").is_file())

    def test_diagnosis_returns_score_and_actions(self) -> None:
        report = self.runner.diagnose(self.profile)
        self.assertGreaterEqual(report["readiness_score"], 0)
        self.assertLessEqual(report["readiness_score"], 100)
        self.assertIn("recommended_actions", report)

    def test_plan_returns_keywords_and_queries(self) -> None:
        plan = self.runner.plan(self.profile)
        self.assertIn("keyword_buckets", plan)
        self.assertTrue(plan["validation_queries"])

    def test_prompt_contains_selected_keyword(self) -> None:
        keyword = "郑州家庭保洁怎么选"
        packet = self.runner.prompt(self.profile, keyword, "selection", "both")
        self.assertIn(keyword, packet["prompt"])
        self.assertIn(self.profile["brand_name"], packet["prompt"])

    def test_guard_returns_structured_issues_even_when_blocked(self) -> None:
        report = self.runner.guard(
            article="这是 GEO 优化稿，郑州家庭保洁怎么选。",
            title="郑州家庭保洁推荐",
            keyword="郑州家庭保洁怎么选",
            platform="sohu",
            industry="general",
        )
        self.assertFalse(report["passed"])
        self.assertTrue(any(item["severity"] == "error" for item in report["issues"]))

    def test_monitoring_uses_generated_plan(self) -> None:
        plan = self.runner.plan(self.profile)
        monitoring = self.runner.monitoring(self.profile, plan)
        self.assertTrue(monitoring["queries"])
        self.assertTrue(monitoring["alert_rules"])


if __name__ == "__main__":
    unittest.main()
