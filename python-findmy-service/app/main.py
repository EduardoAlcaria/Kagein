from fastapi import FastAPI

from app.routes import accounts, people

app = FastAPI(title="python-findmy-service")
app.include_router(accounts.router)
app.include_router(people.router)


@app.get("/health")
def health():
    return {"status": "ok"}
