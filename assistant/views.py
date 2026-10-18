
import time
import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST

from google import genai
from google.genai import types


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

logger = logging.getLogger(__name__)


def home(request):
    return render(request, "assistant/home.html")


@require_POST
def chat_api(request):
    try:
        data = json.loads(request.body)

    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse(
            {"error": "Invalid request data."},
            status=400
        )

    if not isinstance(data, dict):
        return JsonResponse(
            {"error": "Invalid request format."},
            status=400
        )

    message = data.get("message", "")
    history = data.get("history", [])

    # Validate the submitted prompt.
    if not isinstance(message, str) or not message.strip():
        return JsonResponse(
            {"error": "Please enter a message."},
            status=400
        )

    if len(message) > 4000:
        return JsonResponse(
            {"error": "Message is too long."},
            status=400
        )

    if not isinstance(history, list):
        history = []

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()

    if not api_key:
        return JsonResponse(
            {"error": "Gemini API key is not configured."},
            status=503
        )

    # Prepare a limited conversation history.
    contents = []

    for item in history[-10:]:
        if not isinstance(item, dict):
            continue

        role = item.get("role")
        text = item.get("text")

        if role not in ("user", "model"):
            continue

        if not isinstance(text, str) or not text.strip():
            continue

        contents.append(
            types.Content(
                role=role,
                parts=[
                    types.Part.from_text(
                        text=text[:4000]
                    )
                ]
            )
        )

    contents.append(
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(
                    text=message
                )
            ]
        )
    )

    try:
        start_time = time.perf_counter()
        with genai.Client(api_key=api_key) as client:
            response = client.models.generate_content(
                model=os.environ.get(
                    "GEMINI_MODEL",
                    "gemini-3.8-flash"
                ),
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=(
                        "You are Noir AI, a helpful, friendly "
                        "and concise AI assistant. "
                        "For simple questions, reply briefly and clearly. "
                        "Keep answers concise unless the user asks for more detail. "
                        "Avoid unnecessary repetition. "
                    ),
                    thinking_config=types.ThinkingConfig(
                        thinking_level="low"
                    ),
                    max_output_tokens=220
                )
            )

        elapsed = time.perf_counter() - start_time
        print(f"Noir Gemini response time: {elapsed:.2f} seconds")
        reply = response.text

        if not reply:
            return JsonResponse(
                {"error": "The model returned no text."},
                status=502
            )

        return JsonResponse({"reply": reply})

    except Exception:
        logger.exception("Gemini API request failed")

        return JsonResponse(
            {
                "error": (
                    "AI service unavailable. "
                    "Please try again later."
                )
            },
            status=502
        )
