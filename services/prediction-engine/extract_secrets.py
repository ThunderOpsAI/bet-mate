import os
import modal
import json

app = modal.App("extract-secrets")
secrets = [modal.Secret.from_name("betmate-prediction-engine-secrets")]

@app.function(secrets=secrets)
def get_secrets():
    keys = [
        "DATABASE_URL",
        "JWT_SECRET",
        "BETFAIR_APP_KEY",
        "BETFAIR_USERNAME",
        "BETFAIR_PASSWORD",
        "BETFAIR_CERT_PATH",
        "BETFAIR_KEY_PATH",
        "BETFAIR_CERT_PEM",
        "BETFAIR_KEY_PEM",
        "BETFAIR_CERT_PEM_B64",
        "BETFAIR_KEY_PEM_B64",
        "BETFAIR_AUTH_MODE",
        "BETFAIR_API_BASE_URL",
        "BDL_API_KEY",
        "GEMINI_API_KEY",
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_FROM_NUMBER",
        "RESEND_API_KEY",
        "NOTIFY_EMAIL_FROM",
        "PUSHOVER_APP_TOKEN",
        "BETFAIR_SUNDAY_INGEST_URL",
    ]
    return {k: os.environ.get(k) for k in keys if os.environ.get(k)}

@app.local_entrypoint()
def main():
    res = get_secrets.remote()
    with open(".env.downloaded", "w") as f:
        for k, v in res.items():
            f.write(f'{k}="{v}"\n')
    print(f"Downloaded {len(res)} secrets to .env.downloaded")
