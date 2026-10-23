from __future__ import annotations

from pathlib import Path
import unittest


REPO_ROOT = Path(__file__).resolve().parents[3]
WEB_NEXT_CONFIG_PATH = REPO_ROOT / "apps/web/next.config.mjs"
WEB_ML_API_PATH = REPO_ROOT / "apps/web/app/lib/mlApi.ts"
WEB_API_PATH = REPO_ROOT / "apps/web/app/lib/api.ts"
ENV_EXAMPLE_PATH = REPO_ROOT / ".env.example"
BUILD_SPEC_PATH = REPO_ROOT / "docs/BUILD_SPEC.md"
AGENT_HANDOVER_PATH = REPO_ROOT / "docs/AGENT_HANDOVER.md"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class VercelModalContractTests(unittest.TestCase):
    def test_web_ml_api_default_stays_same_origin(self) -> None:
        source = _read(WEB_ML_API_PATH)

        self.assertIn('const DEFAULT_ML_API_PROXY_PATH = "/api/ml-proxy";', source)
        self.assertIn("if (!candidate.startsWith(\"/\")) {", source)
        self.assertNotIn("railway.app", source)
        self.assertNotIn("modal.run", source)
        self.assertNotIn("http://", source)
        self.assertNotIn("https://", source)

    def test_web_api_base_stays_same_origin(self) -> None:
        source = _read(WEB_API_PATH)

        self.assertIn('const DEFAULT_API_BASE = "/api";', source)
        self.assertNotIn("http://", source)
        self.assertNotIn("https://", source)

    def test_next_rewrites_remain_env_driven(self) -> None:
        source = _read(WEB_NEXT_CONFIG_PATH)

        self.assertIn("process.env.ML_API_PROXY_TARGET", source)
        self.assertIn("process.env.API_PROXY_TARGET", source)
        self.assertIn('source: "/api/ml-proxy/:path*"', source)
        self.assertIn('destination: `${mlProxyRaw.replace(/\\/+$/, "")}/:path*`', source)
        self.assertIn('source: "/api/:path*"', source)
        self.assertIn('destination: `${apiProxyTarget.replace(/\\/+$/, "")}/api/:path*`', source)
        self.assertNotIn("railway.app", source)

    def test_env_example_documents_same_origin_proxy_contract(self) -> None:
        source = _read(ENV_EXAMPLE_PATH)

        self.assertIn("NEXT_PUBLIC_ML_API=/api/ml-proxy", source)
        self.assertIn("ML_API_PROXY_TARGET=http://127.0.0.1:8000", source)
        self.assertIn("# ML_API_PROXY_TARGET=https://your-modal-web-endpoint.modal.run", source)
        self.assertIn("NEXT_PUBLIC_API_URL=/api", source)
        self.assertIn("API_PROXY_TARGET=http://127.0.0.1:3001", source)
        self.assertIn("# API_PROXY_TARGET=https://your-api-project.vercel.app", source)

    def test_active_rollout_docs_use_modal_authority(self) -> None:
        for path in (BUILD_SPEC_PATH, AGENT_HANDOVER_PATH):
            if not path.exists():
                continue
            source = _read(path)
            self.assertIn("Modal", source, msg=f"{path} should mention Modal")
            self.assertNotIn("Railway for the prediction engine", source)
            self.assertIn("/api/ml-proxy/health", source)


if __name__ == "__main__":
    unittest.main()
