import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# The client automatically picks up GEMINI_API_KEY from environment variables.
# We initialize it explicitly here to capture if the key is missing.
api_key = os.getenv("GEMINI_API_KEY")
client = None

if api_key:
    client = genai.Client(api_key=api_key)
else:
    print("WARNING: GEMINI_API_KEY not found in environment variables.")

def stream_gemini_response(prompt: str, system_instruction: str = None):
    """
    Generator that streams responses from Google's Gemini model using the new google-genai SDK.
    Yields chunks of string text.
    """
    global client
    
    # Lazy load client if key became available
    if not client:
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            client = genai.Client(api_key=api_key)
            
    if not client:
        yield "\n[Error: GEMINI_API_KEY is missing. Please add it to backend/.env]"
        return
        
    try:
        # Configure model generation parameters
        config = None
        if system_instruction:
            config = types.GenerateContentConfig(
                system_instruction=system_instruction
            )
            
        response = client.models.generate_content_stream(
            model='gemini-3.5-flash-lite',
            contents=prompt,
            config=config
        )
        
        for chunk in response:
            if chunk.text:
                yield chunk.text
    except Exception as e:
        yield f"\n[Error generating response: {str(e)}]"

def generate_gemini_text(prompt: str, system_instruction: str = None) -> str:
    """Generates standard non-streaming text from Gemini for utility API routes."""
    global client
    if not client:
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            client = genai.Client(api_key=api_key)
            
    if not client:
        raise ValueError("GEMINI_API_KEY is missing.")
        
    config = None
    if system_instruction:
        config = types.GenerateContentConfig(
            system_instruction=system_instruction
        )
        
    response = client.models.generate_content(
        model='gemini-3.5-flash-lite',
        contents=prompt,
        config=config
    )
    return response.text or ""

