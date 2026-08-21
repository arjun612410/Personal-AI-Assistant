import os
import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pypdf import PdfReader
from dotenv import load_dotenv
from groq import Groq
from pydantic import BaseModel

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

MODEL = "openai/gpt-oss-120b"
RESUME_PATH = os.getenv("RESUME_PATH", "Arjun Pant-Resume.pdf")



class Experience(BaseModel):
    company: str | None = None
    role: str | None = None
    duration: str | None = None
    description: str | None = None
    skills_used: list[str] = []


class Resume(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    total_experience_years: float | None = None
    skills: list[str] = []
    experiences: list[Experience] = []
    education: list[str] = []
    projects: list[str] = []
    certifications: list[str] = []


resume_schema = Resume.model_json_schema()


class ChatRequest(BaseModel):
    question: str


def read_pdf(file_path: Path) -> str:
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text


def parse_resume(resume_text: str) -> Resume:
    system_prompt = f"""
    You are an expert resume parser.

    Extract information from the resume based on its meaning,
    not only based on exact section headings.

    Different resumes may use different headings, for example:
    - Experience
    - Professional Experience
    - Work History
    - Employment
    - Internships

    These may all contain relevant experience.

    Skills may also appear in the skills section, work experience,
    internships or projects.

    Return ONLY valid JSON matching this schema:
    {resume_schema}

    Important rules:
    1. Do not invent information.
    2. If a value is not available, return null.
    3. If a list has no information, return an empty list.
    4. Include internships inside experiences.
    5. Extract skills mentioned across the entire resume.
    """
    user_prompt = f"Parse the following resume:\n{resume_text}"

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
    )
    raw_output = response.choices[0].message.content
    data = json.loads(raw_output)
    return Resume(**data)


def build_system_prompt(resume: Resume) -> str:
    return f"""
    You are an AI assistant representing a job candidate in an HR interview
    context. You speak in first person, as if you ARE the candidate.

    Here is everything you know about the candidate:
    {resume.model_dump_json(indent=2)}

    HOW TO ANSWER:
    1. Answer ONLY using the information given above. Never invent facts,
       companies, dates, or skills that are not present.
    2. If the information is genuinely not available, say:
       "I don't have that information available to answer that."
    3. Do NOT give one-line answers. Explain properly:
       - Give context (which role/project/company this relates to).
       - Mention relevant skills or tools used.
       - Where useful, briefly explain the impact or outcome.
       Aim for 3-6 sentences unless the question is a simple yes/no or a
       direct factual lookup (like "what's your email?").
    4. Be professional, confident, and conversational — like a real
       candidate talking to HR, not a robot listing bullet points.
    5. If a question is broad (e.g. "tell me about yourself"), synthesize
       across experiences, skills, and projects into a coherent narrative
       instead of just dumping raw fields.
    6. Never break character or mention that you are an AI model reading
       from a JSON object.
    """


@asynccontextmanager
async def lifespan(app: FastAPI):
    resume_text = read_pdf(Path(RESUME_PATH))
    app.state.resume = parse_resume(resume_text)
    print("Resume parsed and cached at startup.")
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "HireMeAI Backend is running!"}


@app.get("/resume")
def get_resume():
    """Frontend isko use karke resume ka structured data dikha sakta hai."""
    return app.state.resume


@app.post("/chat")
def chat(request: ChatRequest):
    try:
        system_prompt = build_system_prompt(app.state.resume)
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.question},
            ],
            temperature=0.4,
        )
        return {"answer": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/stream")
def chat_stream(request: ChatRequest):
    system_prompt = build_system_prompt(app.state.resume)

    def event_generator():
        try:
            stream = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": request.question},
                ],
                temperature=0.4,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    # SSE format: "data: <text>\n\n"
                    yield f"data: {json.dumps({'token': delta})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")