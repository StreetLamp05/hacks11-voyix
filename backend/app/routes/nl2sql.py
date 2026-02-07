from flask import Blueprint, jsonify, request

from ..services.nl2sql_service import ask

nl2sql_bp = Blueprint("nl2sql", __name__)


@nl2sql_bp.route("/api/nl2sql", methods=["POST"])
def nl2sql():
    body = request.get_json(force=True)
    question = (body.get("question") or "").strip()
    if not question:
        return jsonify({"error": "question is required"}), 400

    result = ask(question)

    if "error" in result:
        return jsonify(result), 422
    return jsonify(result)
