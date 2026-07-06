from fastapi import FastAPI

app = FastAPI(title="python-findmy-service")


@app.get("/health")
def health():
    return {"status": "ok"}
