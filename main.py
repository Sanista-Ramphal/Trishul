from flask import Flask, request, jsonify, send_from_directory
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
import os
import re
from utils.generator import generate_password
from utils.strength import analyze_strength
from utils.breach import check_breach

app = Flask(__name__, static_folder="static", template_folder="web")
CORS(app, origins=["*"])

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "60 per hour"],
    storage_uri="memory://"
)

BLOCKED_PATTERNS = [
    r"<script", r"javascript:", r"on\w+=", r"eval\(", r"exec\(",
    r"__import__", r"subprocess", r"os\.system"
]

def sanitize_input(text):
    if not isinstance(text, str):
        return None
    if len(text) > 500:
        return None
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return None
    return text.strip()

@app.route("/")
def index():
    return send_from_directory("web", "index.html")

@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)

@app.route("/generate", methods=["POST"])
@limiter.limit("30 per minute")
def generate():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid request"}), 400

    phrase = sanitize_input(data.get("phrase", ""))
    if not phrase:
        return jsonify({"error": "Invalid or missing phrase"}), 400

    if len(phrase) < 2 or len(phrase) > 200:
        return jsonify({"error": "Phrase must be between 2 and 200 characters"}), 400

    result = generate_password(phrase)
    return jsonify(result)

@app.route("/check-strength", methods=["POST"])
@limiter.limit("60 per minute")
def check_strength():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid request"}), 400

    password = data.get("password", "")
    if not isinstance(password, str):
        return jsonify({"error": "Invalid password format"}), 400

    if len(password) > 512:
        return jsonify({"error": "Password too long"}), 400

    result = analyze_strength(password)
    return jsonify(result)

@app.route("/check-breach", methods=["POST"])
@limiter.limit("20 per minute")
def check_breach_route():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid request"}), 400

    password = data.get("password", "")
    if not isinstance(password, str):
        return jsonify({"error": "Invalid password format"}), 400

    if len(password) > 512:
        return jsonify({"error": "Password too long"}), 400

    result = check_breach(password)
    return jsonify(result)

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": "Rate limit exceeded. Please slow down."}), 429

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    return response

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)
