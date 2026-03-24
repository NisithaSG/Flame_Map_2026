from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import degrees, courses, graph

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(degrees.router)
app.include_router(courses.router)
app.include_router(graph.router)

@app.get("/")
def root():
    return {"message": "FlameMap API is running"}