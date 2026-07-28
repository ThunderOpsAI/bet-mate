import base64
import re
import os

env_path = ".env"
cert_path = "/Users/thunderopsai/Desktop/betfair-client-2048.crt"
key_path = "/Users/thunderopsai/Desktop/betfair-client-2048.key"

with open(cert_path, "rb") as f:
    cert_b64 = base64.b64encode(f.read()).decode("utf-8")
    
with open(key_path, "rb") as f:
    key_b64 = base64.b64encode(f.read()).decode("utf-8")

if os.path.exists(env_path):
    with open(env_path, "r") as f:
        env_content = f.read()
else:
    env_content = ""

env_content = re.sub(r"^BETFAIR_CERT_PEM_B64=.*$\n?", "", env_content, flags=re.MULTILINE)
env_content = re.sub(r"^BETFAIR_KEY_PEM_B64=.*$\n?", "", env_content, flags=re.MULTILINE)

env_content += f"\nBETFAIR_CERT_PEM_B64={cert_b64}\nBETFAIR_KEY_PEM_B64={key_b64}\n"

with open(env_path, "w") as f:
    f.write(env_content)
    
print("Updated .env successfully.")
