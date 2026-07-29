"""Deploy all prediction-engine secrets to Modal.

Reads the local .env via python-dotenv, injects Base64-encoded Betfair
certificate and key material from the local Desktop files (when present),
and pushes everything to the Modal secret named in modal_app.py.

Usage:
    cd services/prediction-engine
    source venv/bin/activate
    python deploy_secret.py
"""

import base64
import os
import sys
from pathlib import Path

import modal
from dotenv import dotenv_values

SECRET_NAME = "betmate-prediction-engine-secrets"
ENV_PATH = Path(__file__).with_name(".env")
CERT_PATH = Path.home() / "Desktop" / "betfair-client-2048.crt"
KEY_PATH = Path.home() / "Desktop" / "betfair-client-2048.key"


def main() -> None:
    if not ENV_PATH.is_file():
        print(f"[ERROR] .env not found at {ENV_PATH}", file=sys.stderr)
        sys.exit(1)

    env_dict = dotenv_values(ENV_PATH)

    # Inject B64-encoded cert/key from local files if they exist and
    # the .env doesn't already contain them.
    for label, path, env_key in [
        ("cert", CERT_PATH, "BETFAIR_CERT_PEM_B64"),
        ("key", KEY_PATH, "BETFAIR_KEY_PEM_B64"),
    ]:
        if not env_dict.get(env_key) and path.is_file():
            encoded = base64.b64encode(path.read_bytes()).decode("utf-8")
            env_dict[env_key] = encoded
            print(f"[OK] Injected {env_key} from {path} ({len(encoded)} chars)")
        elif env_dict.get(env_key):
            print(f"[OK] {env_key} already present in .env ({len(env_dict[env_key])} chars)")
        else:
            print(f"[WARN] {env_key} missing from .env and {path} not found")

    # Drop empty/None values – Modal rejects them.
    env_dict = {k: v for k, v in env_dict.items() if v}

    print(f"\nDeploying {len(env_dict)} keys to Modal secret '{SECRET_NAME}':")
    for key in sorted(env_dict):
        val = env_dict[key]
        display = f"{val[:12]}..." if len(val) > 15 else "<set>"
        print(f"  {key} = {display}")

    import subprocess
    cmd = ["modal", "secret", "create", "--force", "--from-dotenv", str(ENV_PATH), SECRET_NAME]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        print(res.stdout)
        print(f"\n[OK] Modal secret '{SECRET_NAME}' deployed successfully.")
    else:
        print(f"\n[ERROR] Modal secret deployment failed:\n{res.stderr}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
