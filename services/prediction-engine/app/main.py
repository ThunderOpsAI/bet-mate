from fastapi import FastAPI

app = FastAPI(title="BetMate Prediction Engine", version="0.1.0")


@app.get("/health")
def health():
    return {"ok": True, "service": "prediction-engine"}
