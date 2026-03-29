# FlameMap

A visual course map for UIC students - see every course in your major, connected by prerequisites, in an interactive graph.
**Live Web App:** 

## What it does

FlameMap lets you pick a major and see a visual map of every course you need to graduate, with arrows showing which courses unlock which. The UI includes a searchable major picker, keyboard navigation, and a graph view with flowchart and force layouts.

## Project Structure

```
.
├── backend/
│   ├── pipeline/
│   │   ├── course_scraper.py
│   │   ├── courses.json
│   │   ├── degree_scraper.py
│   │   ├── degrees.json
│   │   ├── flamemap.db
│   │   ├── parser.py
│   │   └── seed.py
│   ├── routers/
│   │   ├── courses.py
│   │   ├── degrees.py
│   │   └── graph.py
│   ├── database.py
│   ├── main.py
│   ├── models.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── hooks/
│   │   │   └── useGraph.js
│   │   ├── types/
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── main.tsx
│   │   └── vite-env.d.ts
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
├── README.md
└── .gitignore
```

## Stack

- **Backend**: Python, FastAPI, SQLite
- **Data pipeline**: requests, BeautifulSoup4
- **Frontend**: React, Vite, D3, Dagre
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

### 3. Install backend dependencies

```bash
pip install -r backend/requirements.txt
```

### 4. Run the data pipeline

Run these from inside the `backend/pipeline/` folder:

```bash
cd backend/pipeline

# Step 1 - scrape all UIC courses (~2-4 min)
python course_scraper.py

# Step 2 - scrape all UIC degree pages (~4-6 min)
python degree_scraper.py

# Step 3 - parse prereq strings
python parser.py

# Step 4 - seed the SQLite database
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

### 6. Run the frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite serves the UI at `http://localhost:5173` by default. The frontend expects the backend to be running at `http://localhost:8000`.

## Data

All data is sourced from the UIC Undergraduate Catalog. The pipeline scrapes:

- ~3,985 courses across all departments
- All undergraduate degrees, concentrations, and minors
- Prerequisite relationships parsed from course descriptions

The database files (`flamemap.db`, `courses.json`, `degrees.json`) are gitignored - run the pipeline locally to generate them.

## Status

- [x] Course scraper
- [x] Degree scraper
- [x] Prereq parser
- [x] SQLite seed script
- [x] FastAPI routes
- [x] React frontend
- [ ] Deployment
