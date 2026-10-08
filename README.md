# CareerLens — AI-Powered Employability and Career Readiness Analyzer

## Overview

CareerLens gives students and placement teams a unified, evidence-based view of employability and career readiness. The core principle is **Evidence over keywords**.

---

## Project Structure

```
careerLens/
├── .env                         ← All credentials (fill this in)
├── .gitignore
├── package.json                 ← Root scripts
├── backend/
│   ├── server.js
│   ├── config/
│   │   ├── mongodb.js
│   │   └── postgresql.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── upload.js
│   ├── models/
│   │   ├── User.js
│   │   ├── StudentProfile.js
│   │   ├── Analysis.js
│   │   └── ProofSubmission.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── student.js
│   │   ├── placement.js
│   │   ├── analysis.js
│   │   └── proof.js
│   ├── services/
│   │   ├── dbService.js         ← MongoDB-first / PostgreSQL fallback
│   │   ├── aiEvaluator.js       ← Gemini final evaluation
│   │   ├── evidenceNormalizer.js
│   │   ├── resourceSearch.js    ← Tavily course search
│   │   └── extractors/
│   │       ├── resumeExtractor.js    ← Gemini (PDF → structured)
│   │       ├── githubExtractor.js    ← GitHub API
│   │       ├── portfolioExtractor.js ← Jina + Firecrawl + Groq
│   │       ├── leetcodeExtractor.js  ← GraphQL + Jina + Groq
│   │       ├── gfgExtractor.js       ← API + Jina + Groq
│   │       ├── linkedinExtractor.js  ← Jina + Groq
│   │       └── figmaExtractor.js     ← Jina + Groq
│   └── uploads/
└── client/                      ← React + Vite frontend
    └── src/
        ├── api/axios.js
        ├── context/AuthContext.jsx
        ├── components/
        │   ├── AppLayout.jsx
        │   ├── Sidebar.jsx
        │   ├── ProtectedRoute.jsx
        │   ├── ScoreComponents.jsx
        │   └── ClaimCard.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── StudentRegisterPage.jsx
            ├── PlacementRegisterPage.jsx
            ├── StudentDashboard.jsx
            ├── ProfilePage.jsx
            ├── AnalysisPage.jsx
            ├── ProofPage.jsx
            ├── PlacementDashboard.jsx
            ├── PlacementStudentsPage.jsx
            ├── StudentAnalysisView.jsx
            └── PlacementAnalyticsPage.jsx
```

---

## Setup

### 1. Fill in `.env` (root)

```env
MONGODB_URI=mongodb+srv://...
POSTGRESQL_URI=postgresql://...

GEMINI_API_KEY=...
GROQ_API_KEY=...

GITHUB_TOKEN=...
JINA_API_KEY=...
FIRECRAWL_API_KEY=...
TAVILY_API_KEY=...

JWT_SECRET=change_this_to_a_random_secret
PORT=5000
CLIENT_URL=http://localhost:5173
```

### 2. Install dependencies

```bash
cd backend && npm install
cd ../client && npm install
```

### 3. Run development servers

```bash
# Backend (port 5000)
cd backend && npm run dev

# Frontend (port 5173)
cd client && npm run dev
```

---

## API Usage by Service

| API | Purpose |
|-----|---------|
| **Gemini** | Resume PDF extraction, cross-source validation, AI final evaluation, scoring, recommendations, roadmap |
| **Groq** | Fast extraction tasks — LinkedIn, portfolio, GFG, Figma structured data (Llama-3.1-70b) |
| **GitHub Token** | Repos, languages, commits, forks, ownership, activity via GitHub REST API |
| **Jina** | Clean text/markdown extraction from portfolio, LinkedIn, LeetCode, GFG, Figma URLs |
| **Firecrawl** | Multi-page portfolio crawling fallback when Jina fails |
| **Tavily** | Search for course resources and learning materials for identified gaps |

---

## Analysis Pipeline

```
Student Inputs (resume + links)
    ↓
Source Collection (profile + URLs)
    ↓
Data Extraction (per extractor)
    ↓
Evidence Normalization (evidenceNormalizer.js)
    ↓
Cross-Source Alignment
    ↓
Structured Student Evidence
    ↓
Gemini AI Final Evaluation
    ↓
Claim Validation  →  Explainable Scores  →  Role Fit
    ↓
Course / Project Recommendations  →  Personalized Roadmap
    ↓
Store in MongoDB + Sync to PostgreSQL
```

---

## Security

- All API keys are server-side only (`.env`, never exposed to browser)
- JWT authentication on all protected endpoints
- Role-based authorization (student / placement)
- Placement cells can only access **approved** student data
- File uploads validated by type and size
- Rate limiting on all `/api/` routes
