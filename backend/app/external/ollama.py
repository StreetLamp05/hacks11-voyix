import requests


OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "qwen2.5-coder:32b"
DEFAULT_TIMEOUT = 120


def generate(prompt, system="", model=DEFAULT_MODEL, timeout=DEFAULT_TIMEOUT):
    """Send a prompt to the local Ollama instance and return the response text."""
    payload = {
        "model": model,
        "prompt": prompt,
        "system": system,
        "stream": False,
    }
    resp = requests.post(OLLAMA_URL, json=payload, timeout=timeout)
    resp.raise_for_status()
    return resp.json()["response"]
