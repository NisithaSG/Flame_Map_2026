# FlameMap

A visual course map for UIC students — see every course in your major, connected by prerequisites, in an interactive graph.

## What it does

FlameMap lets you pick a major and see a visual map of every course you need to graduate, with arrows showing which courses unlock which. Mark courses you've completed and see what opens up next.

## Project Structure

```
flamemap/
├── backend/
│   ├── pipeline/
│   │   ├── course_scraper.py   # scrapes all UIC department course pages
│   │   ├── degree_scraper.py   # scrapes all UIC degree requirement pages
│   │   ├── parser.py           # parses prereq strings into structured logic
│   │   └── seed.py             # loads JSON data into SQLite
│   ├── routers/
│   │   ├── courses.py          # GET /course/{id}
│   │   ├── degrees.py          # GET /degrees
│   │   └── graph.py            # GET /degree/{id}/graph
│   ├── database.py             # SQLite connection setup
│   ├── models.py               # Pydantic models
│   ├── main.py                 # FastAPI app entry point
│   └── requirements.txt
└── frontend/                   # React app (coming soon)
```

## Stack

- **Backend**: Python, FastAPI, SQLite
- **Data pipeline**: requests, BeautifulSoup4
- **Frontend**: React, Cytoscape.js (coming soon)
- **Hosting**: Render (backend), Vercel (frontend)

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/flamemap.git
cd flamemap
```

### 2. Create and activate a virtual environment

```bash
python -m venv .venv

# Mac/Linux
source .venv/bin/activate

# Windows
.venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r backend/requirements.txt
```

### 4. Run the data pipeline

Run these from inside the `backend/pipeline/` folder:

```bash
cd backend/pipeline

# Step 1 — scrape all UIC courses (~2-4 min)
python course_scraper.py

# Step 2 — scrape all UIC degree pages (~4-6 min)
python degree_scraper.py

# Step 3 — parse prereq strings
python parser.py

# Step 4 — seed the SQLite database
python seed.py
```

This produces `flamemap.db` in the `backend/` folder with 3 tables: `courses`, `degrees`, and `sections`.

### 5. Run the API

```bash
cd backend
uvicorn main:app --reload
```

API runs at `http://localhost:8000`
Interactive docs at `http://localhost:8000/docs`

## Data

All data is sourced from the [UIC Undergraduate Catalog](https://catalog.uic.edu). The pipeline scrapes:

- ~3,985 courses across all departments
- All undergraduate degrees, concentrations, and minors
- Prerequisite relationships parsed from course descriptions

The database files (`flamemap.db`, `courses.json`, `degrees.json`) are gitignored — run the pipeline locally to generate them.

## Status

- [x] Course scraper
- [x] Degree scraper  
- [x] Prereq parser
- [x] SQLite seed script
- [ ] FastAPI routes
- [ ] React frontend
- [ ] Deployment