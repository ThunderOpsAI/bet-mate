from __future__ import annotations

import ast
from pathlib import Path
import sys
import unittest
from unittest import mock

MODAL_APP_PATH = Path(__file__).resolve().parents[1] / "modal_app.py"
sys.path.insert(0, str(MODAL_APP_PATH.parent))

import app.database as database


def _modal_app_module() -> ast.Module:
    return ast.parse(MODAL_APP_PATH.read_text(encoding="utf-8"))


def _module_string_constants() -> dict[str, str]:
    constants: dict[str, str] = {}
    module = _modal_app_module()
    for node in module.body:
        if not isinstance(node, ast.Assign):
            continue
        if len(node.targets) != 1 or not isinstance(node.targets[0], ast.Name):
            continue
        if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
            constants[node.targets[0].id] = node.value.value
    return constants


def _string_value(node: ast.AST, constants: dict[str, str]) -> str:
    if isinstance(node, ast.Constant):
        return str(node.value)
    if isinstance(node, ast.JoinedStr):
        parts: list[str] = []
        for value in node.values:
            if isinstance(value, ast.Constant):
                parts.append(str(value.value))
                continue
            if isinstance(value, ast.FormattedValue) and isinstance(value.value, ast.Name):
                parts.append(constants.get(value.value.id, value.value.id))
                continue
            raise AssertionError(f"Unsupported string node: {ast.dump(value)}")
        return "".join(parts)
    raise AssertionError(f"Unsupported string node: {ast.dump(node)}")


def _find_assign_dict(name: str) -> dict[str, str]:
    module = _modal_app_module()
    constants = _module_string_constants()
    for node in module.body:
        if not isinstance(node, ast.FunctionDef) or node.name != name:
            continue
        for statement in node.body:
            if isinstance(statement, ast.Return) and isinstance(statement.value, ast.Dict):
                result: dict[str, str] = {}
                for key_node, value_node in zip(statement.value.keys, statement.value.values):
                    if isinstance(key_node, ast.Constant):
                        result[str(key_node.value)] = _string_value(value_node, constants)
                return result
    raise AssertionError(f"Could not locate return dict for {name}")


def _cron_schedules() -> dict[str, tuple[str, str]]:
    module = _modal_app_module()
    schedules: dict[str, tuple[str, str]] = {}
    for node in module.body:
        if not isinstance(node, ast.FunctionDef):
            continue
        for decorator in node.decorator_list:
            if not isinstance(decorator, ast.Call):
                continue
            if not isinstance(decorator.func, ast.Attribute) or decorator.func.attr != "function":
                continue
            for keyword in decorator.keywords:
                if keyword.arg != "schedule" or not isinstance(keyword.value, ast.Call):
                    continue
                cron_call = keyword.value
                if not isinstance(cron_call.func, ast.Attribute) or cron_call.func.attr != "Cron":
                    continue
                expr = cron_call.args[0]
                timezone_kw = next((kw for kw in cron_call.keywords if kw.arg == "timezone"), None)
                if not isinstance(expr, ast.Constant) or not isinstance(timezone_kw, ast.keyword):
                    continue
                if not isinstance(timezone_kw.value, ast.Constant):
                    continue
                schedules[node.name] = (str(expr.value), str(timezone_kw.value.value))
    return schedules


class ModalMigrationTests(unittest.TestCase):
    def test_modal_common_env_disables_sqlite_fallback(self) -> None:
        common_env = _find_assign_dict("_common_env")

        self.assertEqual(common_env["MODEL_ARTIFACT_DIR"], "/vol/betmate-models/models")
        self.assertEqual(common_env["BETMATE_ALLOW_SQLITE"], "0")
        self.assertEqual(common_env["BETMATE_REQUIRE_PERSISTENT_STORAGE"], "1")

    def test_modal_cron_jobs_match_phase4_schedule(self) -> None:
        schedules = _cron_schedules()

        self.assertEqual(
            schedules,
            {
                "nightly_strategy_refresh": ("0 5 * * *", "Australia/Melbourne"),
                "race_data_refresh": ("0 4 * * *", "Australia/Melbourne"),
                "afl_model_refresh": ("15 4 * * *", "Australia/Melbourne"),
                "nba_model_refresh": ("30 4 * * *", "Australia/Melbourne"),
                "sunday_betfair_import": ("0 6 * * 0", "Australia/Melbourne"),
            },
        )

    def test_modal_secret_keys_include_database_and_jwt(self) -> None:
        source = MODAL_APP_PATH.read_text(encoding="utf-8")

        self.assertIn('"DATABASE_URL"', source)
        self.assertIn('"JWT_SECRET"', source)

    def test_require_database_url_rejects_missing_value(self) -> None:
        with (
            mock.patch.dict("os.environ", {}, clear=True),
            self.assertRaisesRegex(RuntimeError, "DATABASE_URL required in production"),
        ):
            database.require_database_url()

    def test_require_database_url_allows_test_sqlite_opt_in(self) -> None:
        with mock.patch.dict("os.environ", {"BETMATE_ALLOW_SQLITE": "1"}, clear=True):
            database.require_database_url()


if __name__ == "__main__":
    unittest.main()
