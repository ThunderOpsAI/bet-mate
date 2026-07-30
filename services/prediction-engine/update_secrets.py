import modal
import os
import base64

def main():
    with open("/Users/thunderopsai/Desktop/betfair-client-2048.crt", "rb") as f:
        cert_b64 = base64.b64encode(f.read()).decode("utf-8")
        
    with open("/Users/thunderopsai/Desktop/betfair-client-2048.key", "rb") as f:
        key_b64 = base64.b64encode(f.read()).decode("utf-8")
        
    # Read the current .env file or env vars to preserve the rest
    # Modal CLI doesn't easily expose getting a secret's raw values via CLI.
    # We will use dotenv if we can, or just tell the user to manually update the .env if we can't.
    print(f"CERT: {cert_b64[:20]}...")
    print(f"KEY: {key_b64[:20]}...")
    
main()
