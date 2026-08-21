# Personal AI Assistant 🤖

An AI-powered interview interface trained on my resume — ask it anything you'd ask a candidate, and get real-time, streaming answers grounded strictly in my actual experience.

---

## 🔗 Live Links

- **Live Site:** https://personal-ai-assistant-chi-nine.vercel.app/
- **Backend API:** https://personal-ai-assistant-hjbw.onrender.com

> ⚠️ Backend is hosted on Render's free tier — it may take 30–50 seconds to wake up on the first request after inactivity.

---

## ✨ Features

- 🗣️ **Conversational AI** — ask questions as if interviewing the candidate directly
- ⚡ **Real-time streaming responses** — answers appear token-by-token, like a live typing effect
- 📄 **Resume-grounded answers** — the AI never fabricates info; it only responds using data extracted from the actual resume
- 🎨 **Custom-built frontend** — animated hero section with a live node-network background, clean chat UI
- 🔒 **Structured resume parsing** — resume is parsed once into a strict schema (skills, experience, education, projects, certifications) at startup, not on every request

---

## 🛠️ Tech Stack

**Frontend**
- HTML, CSS, JavaScript (vanilla, no framework)
- Canvas API for the animated background
- Server-Sent Events (SSE) for streaming chat

**Backend**
- FastAPI (Python)
- Groq API (`openai/gpt-oss-120b`) for parsing + chat completions
- Pydantic for structured resume schema
- pypdf for resume text extraction

**Deployment**
- Backend → Render
- Frontend → Vercel

---

## 📁 Project Structure

```
personal-ai-assistant/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── resume.pdf
└── frontend/
    ├── index.html
    ├── style.css
    └── script.js
```

---

## ⚙️ Running Locally

### Backend
```bash
cd backend
pip install -r requirements.txt
```
Create a `.env` file inside `backend/`:
```
GROQ_API_KEY=your_groq_api_key_here
```
Then run:
```bash
uvicorn main:app --reload
```
Backend will start at `http://127.0.0.1:8000`

### Frontend
```bash
cd frontend
python -m http.server 5500
```
Open `http://127.0.0.1:5500/index.html` in your browser.

> Make sure `API_BASE` at the top of `script.js` points to your backend URL (local or deployed).

---

## 🔌 API Endpoints

| Method | Endpoint       | Description                                  |
|--------|----------------|-----------------------------------------------|
| GET    | `/`            | Health check                                  |
| GET    | `/resume`      | Returns parsed, structured resume data        |
| POST   | `/chat`        | Non-streaming chat — returns full answer      |
| POST   | `/chat/stream` | Streaming chat — SSE, token-by-token response |

**Request body for `/chat` and `/chat/stream`:**
```json
{
  "question": "What are your key skills?"
}
```

---

## 📌 Notes

- CORS is currently configured for `[origins]` — update this in `main.py` if you fork/deploy your own version.
- The Groq API key must be kept secret — never commit `.env` to version control.

---

Built with FastAPI + Groq + a lot of debugging 🚀