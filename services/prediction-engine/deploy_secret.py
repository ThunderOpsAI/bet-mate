import modal
import os
import base64
from dotenv import dotenv_values

env_path = ".env"
cert_path = "/Users/thunderopsai/Desktop/betfair-client-2048.crt"
key_path = "/Users/thunderopsai/Desktop/betfair-client-2048.key"

with open(cert_path, "rb") as f:
    cert_b64 = base64.b64encode(f.read()).decode("utf-8")
    
with open(key_path, "rb") as f:
    key_b64 = base64.b64encode(f.read()).decode("utf-8")

# Read existing env vars
env_dict = dotenv_values(env_path)

# Add the new ones
env_dict["BETFAIR_CERT_PEM_B64"] = cert_b64
env_dict["BETFAIR_KEY_PEM_B64"] = key_b64

# Filter out empty or None values before passing to Modal
env_dict = {k: v for k, v in env_dict.items() if v is not None}

print("Creating Modal Secret...")
# Modal Python API syntax: modal.Secret.from_dict()
secret = modal.Secret.from_dict(env_dict)

# Wait, in the newest modal sdk we should use modal.Secret.from_dict
# But we need to save it to the cloud.
# We can use the modal CLI instead if we just pass them explicitly, but there might be too many.
