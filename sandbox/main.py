from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def testing():
    return {"status": "ok"}