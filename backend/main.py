import os
import json
import asyncio
from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
from services.gemini import stream_gemini_response, generate_gemini_text
from services import db


app = FastAPI(title="Spark Ignite API", version="1.0.0")

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
    language: Optional[str] = "English"


# System instruction to define the Spark Ignite Coach persona
COACH_SYSTEM_INSTRUCTION = (
    "You are Spark Ignite, an elite, motivational, and highly knowledgeable AI Health, Nutrition, and Workout Coach. "
    "Your goal is to help the user achieve their fitness targets with precise, actionable, and science-backed advice. "
    "Maintain a supportive, energetic, and positive tone. Make your answers concise, structured, and easy to read "
    "using markdown (bullet points, bold highlights, sub-headers). Avoid lengthy paragraphs. "
    "CRITICAL: Always respond in the same language and script that the user is conversing in. "
    "If the user asks questions in Hinglish (Hindi using English characters), reply in Hinglish. "
    "If they ask in Hindi (Devanagari script), reply in Hindi (Devanagari). "
    "If they ask in English, reply in English."
)

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "Spark Ignite Backend", "keys_configured": os.getenv("GEMINI_API_KEY") is not None}

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
        f"Format the output beautifully with clear section headers, bold bullet points, and tables where helpful.\n\n"
        f"CRITICAL: You MUST write the entire generated blueprint (all text, section titles, workout schedules, food items, and descriptions) in the following language: {req.language}.\n"
        f"- If language is 'Hinglish', write everything in conversational Hinglish (Hindi written in English Latin characters, e.g., 'Aapko subah 7 baje 2 ande khane chahiye').\n"
        f"- If language is 'Hindi', write everything in Devanagari script (e.g., 'आपको सुबह 7 बजे 2 अंडे खाने चाहिए').\n"
        f"- If language is 'English', write everything in English."

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
    Handles conversational interactions with the Spark Ignite Coach.
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

# Pydantic models for authentication
class UserAuth(BaseModel):
    email: str
    password: str
    recovery_question: Optional[str] = None
    recovery_answer: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    email: str
    question: str
    answer: str
    new_password: str



class SavePlan(BaseModel):
    token: str
    goal: str
    metrics: dict
    plan_text: str

class DeletePlan(BaseModel):
    token: str
    plan_id: int


def get_user_from_token(token: str):
    """Parses our simple stateless session token: 'token-{id}-{email}'"""
    if not token or not token.startswith("token-"):
        return None
    try:
        parts = token.split("-")
        if len(parts) >= 3:
            user_id = int(parts[1])
            email = parts[2]
            return {"id": user_id, "email": email}
    except Exception:
        return None
    return None

@app.post("/api/auth/register")
def register(req: UserAuth):
    try:
        user_id = db.register_user(req.email, req.password, req.recovery_question, req.recovery_answer)
        # Generate simple session token
        token = f"token-{user_id}-{req.email.strip().lower()}"
        return {"status": "success", "token": token, "email": req.email.strip().lower()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/api/auth/login")
def login(req: UserAuth):
    try:
        user = db.login_user(req.email, req.password)
        # Generate simple session token
        token = f"token-{user['id']}-{user['email']}"
        return {"status": "success", "token": token, "email": user["email"]}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/auth/forgot-password")
def forgot_password(email: str):
    try:
        question = db.get_recovery_question(email)
        return {"recovery_question": question}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    try:
        db.reset_password_with_recovery(req.email, req.question, req.answer, req.new_password)
        return {"status": "success"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



@app.post("/api/plan/save")
def save_user_plan(req: SavePlan):
    user = get_user_from_token(req.token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized session. Please login again.")
    
    try:
        plan_id = db.save_plan(user["id"], req.goal, req.metrics, req.plan_text)
        return {"status": "success", "plan_id": plan_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save plan: {str(e)}")

@app.get("/api/plans")
def get_user_plans(token: Optional[str] = Query(None), authorization: Optional[str] = Header(None)):
    # Retrieve token from query params or Authorization header
    auth_token = token
    if not auth_token and authorization:
        if authorization.startswith("Bearer "):
            auth_token = authorization.split(" ")[1]
        else:
            auth_token = authorization
            
    user = get_user_from_token(auth_token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized session. Please login again.")
        
    try:
        plans = db.get_saved_plans(user["id"])
        return {"plans": plans}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve plans: {str(e)}")

@app.post("/api/plan/delete")
def delete_user_plan(req: DeletePlan):
    user = get_user_from_token(req.token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized session. Please login again.")
    try:
        db.delete_plan(user["id"], req.plan_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete plan: {str(e)}")


# Pydantic models for tracking functionality
class WeightLogRequest(BaseModel):
    token: str
    weight: float
    date: str

class DailyLogRequest(BaseModel):
    token: str
    type: str # 'food' or 'workout'
    description: str
    calories: int
    date: str

class DailyLogDeleteRequest(BaseModel):
    token: str
    log_id: int

@app.post("/api/logs/weight")
def add_weight_log(req: WeightLogRequest):
    user = get_user_from_token(req.token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        db.log_weight(user["id"], req.weight, req.date)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs/weight")
def get_weight_logs(token: str):
    user = get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        history = db.get_weight_history(user["id"])
        return {"history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/logs/daily")
def add_daily_log(req: DailyLogRequest):
    user = get_user_from_token(req.token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        log_id = db.add_daily_log(user["id"], req.type, req.description, req.calories, req.date)
        return {"status": "success", "id": log_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs/daily")
def get_daily_logs(token: str, date: str):
    user = get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        logs = db.get_daily_logs(user["id"], date)
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/logs/daily/delete")
def delete_daily_log(req: DailyLogDeleteRequest):
    user = get_user_from_token(req.token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        db.delete_daily_log(user["id"], req.log_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Pydantic models for deactivation and AI logs
class DeactivateAccountRequest(BaseModel):
    token: str

class AICalorieRequest(BaseModel):
    token: str
    text: str
    date: str

@app.post("/api/auth/delete-account")
def delete_account(req: DeactivateAccountRequest):
    user = get_user_from_token(req.token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized session. Please login again.")
    try:
        db.delete_user(user["id"])
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")

@app.post("/api/logs/daily/ai")
def log_daily_ai(req: AICalorieRequest):
    user = get_user_from_token(req.token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Configure prompt for Gemini to parse food and return JSON
    prompt = (
        f"You are an AI nutritionist. The user logged the following meal in natural language:\n"
        f"'{req.text}'\n\n"
        f"Analyze the text and estimate the calories for each food item. "
        f"Respond ONLY with a valid JSON array of objects, where each object has a 'description' (string) "
        f"and 'calories' (integer). Example: [{{\"description\": \"2 Rotis\", \"calories\": 240}}, {{\"description\": \"Paneer Tikka\", \"calories\": 300}}]. "
        f"Do not include markdown tags, code block indicators, backticks, or any conversational text. "
        f"Only return the raw JSON array."
    )
    
    try:
        # Call non-streaming text generator helper
        raw_text = generate_gemini_text(prompt).strip()
        
        # Clean any backticks or markdown JSON wrapper if Gemini added it
        if raw_text.startswith("```json"):
            raw_text = raw_text.replace("```json", "", 1)
        if raw_text.startswith("```"):
            raw_text = raw_text.replace("```", "", 1)
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3].strip()
            
        parsed_items = json.loads(raw_text.strip())
        
        # Insert each item into DB
        for item in parsed_items:
            desc = item.get("description", "Unknown food")
            cals = int(item.get("calories", 0))
            db.add_daily_log(user["id"], "food", desc, cals, req.date)
            
        return {"status": "success", "logged_items": parsed_items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI parsing error: {str(e)}")


@app.post("/api/logs/daily/ai-workout")
def log_daily_workout_ai(req: AICalorieRequest):
    user = get_user_from_token(req.token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Configure prompt for Gemini to parse workout and return JSON
    prompt = (
        f"You are an AI fitness assistant. The user logged the following physical activity in natural language:\n"
        f"'{req.text}'\n\n"
        f"Analyze the text and estimate the calories burned for each exercise or workout. "
        f"Respond ONLY with a valid JSON array of objects, where each object has a 'description' (string) "
        f"and 'calories' (integer). Example: [{{\"description\": \"5K Run\", \"calories\": 350}}, {{\"description\": \"Bench Press\", \"calories\": 120}}]. "
        f"Do not include markdown tags, code block indicators, backticks, or any conversational text. "
        f"Only return the raw JSON array."
    )
    
    try:
        # Call non-streaming text generator helper
        raw_text = generate_gemini_text(prompt).strip()
        
        # Clean any backticks or markdown JSON wrapper if Gemini added it
        if raw_text.startswith("```json"):
            raw_text = raw_text.replace("```json", "", 1)
        if raw_text.startswith("```"):
            raw_text = raw_text.replace("```", "", 1)
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3].strip()
            
        parsed_items = json.loads(raw_text.strip())
        
        # Insert each activity item into DB
        for item in parsed_items:
            desc = item.get("description", "Unknown activity")
            cals = int(item.get("calories", 0))
            db.add_daily_log(user["id"], "workout", desc, cals, req.date)
            
        return {"status": "success", "logged_items": parsed_items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI parsing error: {str(e)}")




# Mount production frontend build directory if it exists

frontend_dist_path = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dist_path):
    app.mount("/", StaticFiles(directory=frontend_dist_path, html=True), name="static")
    print(f"Mounted static files from: {frontend_dist_path}")
else:
    print("Static files directory not found. Serving API routes only.")
