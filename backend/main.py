import os
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
from services.gemini import stream_gemini_response

app = FastAPI(title="FitVibe API", version="1.0.0")

# Enable CORS for local development (frontend runs on different port during dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request validation
class ChatMessage(BaseModel):
    role: str # 'user' or 'model'
    parts: str

class ChatRequest(BaseModel):
    history: List[ChatMessage]
    message: str
    userProfile: Optional[dict] = None

class PlanRequest(BaseModel):
    age: int
    gender: str
    weight: float # in kg
    height: float # in cm
    goal: str # e.g. weight_loss, muscle_gain, general_fitness
    diet: str # e.g. vegetarian, vegan, non_vegetarian, keto
    activity_level: str # e.g. sedentary, light, active, very_active

# System instruction to define the FitVibe Coach persona
COACH_SYSTEM_INSTRUCTION = (
    "You are FitVibe, an elite, motivational, and highly knowledgeable AI Health, Nutrition, and Workout Coach. "
    "Your goal is to help the user achieve their fitness targets with precise, actionable, and science-backed advice. "
    "Maintain a supportive, energetic, and positive tone. Make your answers concise, structured, and easy to read "
    "using markdown (bullet points, bold highlights, sub-headers). Avoid lengthy paragraphs."
)

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "FitVibe Backend", "keys_configured": os.getenv("GEMINI_API_KEY") is not None}

@app.post("/api/plan/stream")
def stream_plan(req: PlanRequest):
    """
    Generate a personalized nutrition and workout plan based on user metrics and goals.
    Streams the response back to the client.
    """
    prompt = (
        f"Generate a highly customized, 7-day fitness and nutrition blueprint for a user with the following profile:\n"
        f"- Age: {req.age}\n"
        f"- Gender: {req.gender}\n"
        f"- Weight: {req.weight} kg\n"
        f"- Height: {req.height} cm\n"
        f"- Fitness Goal: {req.goal.replace('_', ' ').title()}\n"
        f"- Dietary Pattern: {req.diet.replace('_', ' ').title()}\n"
        f"- Daily Activity Level: {req.activity_level.replace('_', ' ').title()}\n\n"
        f"Please provide:\n"
        f"1. A calculated Daily Caloric & Macronutrient Target (Protein, Carbs, Fats).\n"
        f"2. A customized 7-Day Workout Plan matching their goals.\n"
        f"3. A 7-Day Meal Plan fitting their dietary pattern.\n"
        f"4. 3 Actionable Lifestyle & Recovery Hacks to speed up progress.\n"
        f"Format the output beautifully with clear section headers, bold bullet points, and tables where helpful."
    )

    async def plan_generator():
        try:
            # Yield initial token to indicate start
            yield "data: [START]\n\n"
            for chunk in stream_gemini_response(prompt, system_instruction=COACH_SYSTEM_INSTRUCTION):
                # SSE format: data: <content>\n\n
                # We double-escape newlines to prevent SSE protocol from splitting lines prematurely,
                # or we just send it as raw text block. Let's send the text content.
                # Standard EventSource reads 'data: ' and appends the content.
                # To support multiline text, we replace raw newlines with a special delimiter or simply send raw data.
                # A robust way is to just send the raw text chunk directly if using standard fetch stream on the frontend.
                # Let's send the text chunk directly without SSE 'data:' prefix if using fetch stream, 
                # OR send standard SSE data line. Let's use simple plain-text streaming which is much easier to parse in JS!
                # Wait, the frontend can just read a raw text stream using Response.body.getReader()! 
                # Yes! Raw text streaming is extremely simple and avoids SSE formatting complications in JS!
                yield chunk
                await asyncio.sleep(0.01) # Yield control back to event loop
        except Exception as e:
            yield f"\n[Error: {str(e)}]"

    return StreamingResponse(plan_generator(), media_type="text/plain")

@app.post("/api/chat/stream")
def stream_chat(req: ChatRequest):
    """
    Handles conversational interactions with the FitVibe Coach.
    Streams the response back.
    """
    # Construct conversation history prompt
    history_context = ""
    if req.userProfile:
        history_context += (
            f"User Profile Info: Goal is {req.userProfile.get('goal')}, "
            f"Diet is {req.userProfile.get('diet')}, weight is {req.userProfile.get('weight')}kg, "
            f"height is {req.userProfile.get('height')}cm.\n\n"
        )
    
    history_context += "Conversation History:\n"
    for msg in req.history:
        role_label = "User" if msg.role == "user" else "Coach"
        history_context += f"{role_label}: {msg.parts}\n"
    
    history_context += f"User: {req.message}\n"
    history_context += "Coach (streaming response):"

    async def chat_generator():
        try:
            for chunk in stream_gemini_response(history_context, system_instruction=COACH_SYSTEM_INSTRUCTION):
                yield chunk
                await asyncio.sleep(0.01)
        except Exception as e:
            yield f"\n[Error: {str(e)}]"

    return StreamingResponse(chat_generator(), media_type="text/plain")

# Mount production frontend build directory if it exists
frontend_dist_path = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dist_path):
    app.mount("/", StaticFiles(directory=frontend_dist_path, html=True), name="static")
    print(f"Mounted static files from: {frontend_dist_path}")
else:
    print("Static files directory not found. Serving API routes only.")
