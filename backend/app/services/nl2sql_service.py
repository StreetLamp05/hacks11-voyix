import re

from psycopg2.extras import RealDictCursor

from ..db import get_connection, release_connection
from ..external.ollama import generate


# ---------------------------------------------------------------------------
# Human-readable table/view descriptions included in every prompt
# ---------------------------------------------------------------------------
TABLE_DESCRIPTIONS = {
    "restaurants": "Restaurant locations and metadata",
    "ingredients": "Master catalog of all ingredients (name, unit, category, cost)",
    "restaurant_ingredients": "Which ingredients each restaurant tracks, with lead time and safety stock settings",
    "daily_inventory_log": "Daily snapshot: opening/closing inventory, qty used, received, wasted, on-order, covers, and 7-day avg usage",
    "purchase_orders": "Purchase orders header (status, dates, totals)",
    "purchase_order_items": "Line items on each purchase order",
    "menu_items": "Menu dishes with price and category",
    "menu_item_ingredients": "Recipe: which ingredients (and how much) go into each menu item",
    "predictions": "ML-generated demand forecasts per ingredient per day",
    "item_data": "Supplementary item-level data",
}

# ---------------------------------------------------------------------------
# Few-shot examples so the LLM learns the schema style
# ---------------------------------------------------------------------------
FEW_SHOT_EXAMPLES = [
    {
        "question": "How many ingredients do we have?",
        "sql": "SELECT COUNT(*) AS ingredient_count FROM restaurant_ingredients WHERE restaurant_id = 1;",
    },
    {
        "question": "What are the top 5 ingredients by average daily usage?",
        "sql": (
            "SELECT DISTINCT ON (d.ingredient_id) i.ingredient_name, "
            "ROUND(d.avg_daily_usage_7d::numeric, 2) AS avg_daily_usage "
            "FROM daily_inventory_log d "
            "JOIN ingredients i ON i.ingredient_id = d.ingredient_id "
            "WHERE d.restaurant_id = 1 "
            "ORDER BY d.ingredient_id, d.log_date DESC, avg_daily_usage DESC "
            "LIMIT 5;"
        ),
    },
    {
        "question": "Which ingredients are predicted to run out in the next 3 days?",
        "sql": (
            "SELECT i.ingredient_name, p.predicted_qty, p.prediction_date "
            "FROM predictions p "
            "JOIN ingredients i ON i.ingredient_id = p.ingredient_id "
            "WHERE p.restaurant_id = 1 "
            "AND p.prediction_date <= CURRENT_DATE + INTERVAL '3 days' "
            "AND p.predicted_qty <= 0 "
            "ORDER BY p.prediction_date "
            "LIMIT 100;"
        ),
    },
    {
        "question": "What is our total inventory value?",
        "sql": (
            "SELECT ROUND(SUM(d.inventory_end * i.cost_per_unit)::numeric, 2) AS total_value "
            "FROM ("
            "  SELECT DISTINCT ON (ingredient_id) ingredient_id, inventory_end "
            "  FROM daily_inventory_log "
            "  WHERE restaurant_id = 1 ORDER BY ingredient_id, log_date DESC"
            ") d "
            "JOIN ingredients i ON i.ingredient_id = d.ingredient_id;"
        ),
    },
]

# ---------------------------------------------------------------------------
# Dangerous SQL keywords (case-insensitive regex)
# ---------------------------------------------------------------------------
_DANGEROUS_RE = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY|EXECUTE)\b",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Schema context — built dynamically from information_schema
# ---------------------------------------------------------------------------
def build_schema_context():
    """Query information_schema for all public tables/columns and return a formatted string."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT c.table_name, c.column_name, c.data_type, c.is_nullable,
                       kcu.constraint_name
                FROM information_schema.columns c
                LEFT JOIN information_schema.key_column_usage kcu
                       ON kcu.table_name = c.table_name
                      AND kcu.column_name = c.column_name
                      AND kcu.table_schema = 'public'
                WHERE c.table_schema = 'public'
                ORDER BY c.table_name, c.ordinal_position
            """)
            rows = cur.fetchall()
    finally:
        release_connection(conn)

    tables = {}
    for r in rows:
        tables.setdefault(r["table_name"], []).append(r)

    lines = []
    for tbl, cols in tables.items():
        desc = TABLE_DESCRIPTIONS.get(tbl, "")
        header = f"-- {tbl}" + (f"  ({desc})" if desc else "")
        lines.append(header)
        for c in cols:
            pk = " PK" if c["constraint_name"] and "pkey" in c["constraint_name"] else ""
            nullable = "" if c["is_nullable"] == "YES" else " NOT NULL"
            lines.append(f"    {c['column_name']}  {c['data_type']}{nullable}{pk}")
        lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------
def build_system_prompt():
    schema = build_schema_context()

    examples = "\n".join(
        f"Q: {ex['question']}\nSQL: {ex['sql']}" for ex in FEW_SHOT_EXAMPLES
    )

    return f"""You are a SQL assistant for a restaurant inventory PostgreSQL database.

SCHEMA:
{schema}

RULES:
- Generate ONLY a single SELECT query (or WITH ... SELECT). Never INSERT/UPDATE/DELETE/DROP.
- Always filter by restaurant_id = 1.
- Use JOINs when the question involves data from multiple tables.
- Use DISTINCT ON for "latest" rows from daily_inventory_log (ORDER BY ingredient_id, log_date DESC).
- ROUND numeric results to 2 decimal places.
- Always end with LIMIT 100 unless the user asks for a specific count.
- Return ONLY the SQL inside a ```sql code block. No explanation.

EXAMPLES:
{examples}"""


# ---------------------------------------------------------------------------
# SQL extraction & validation
# ---------------------------------------------------------------------------
def extract_sql(text):
    """Pull SQL out of ```sql ... ``` or bare ``` ... ``` blocks, or treat as raw SELECT."""
    # Try ```sql ... ```
    m = re.search(r"```sql\s*\n?(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()
    # Try bare ``` ... ```
    m = re.search(r"```\s*\n?(.*?)```", text, re.DOTALL)
    if m:
        return m.group(1).strip()
    # Fallback: find first SELECT or WITH
    m = re.search(r"((?:WITH|SELECT)\b.+)", text, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip().rstrip(";") + ";"
    return text.strip()


def validate_sql(sql):
    """Raise ValueError if SQL contains dangerous keywords or doesn't start with SELECT/WITH."""
    upper = sql.strip().upper()
    if not (upper.startswith("SELECT") or upper.startswith("WITH")):
        raise ValueError("Query must start with SELECT or WITH")
    match = _DANGEROUS_RE.search(sql)
    if match:
        raise ValueError(f"Forbidden keyword: {match.group(0)}")


def _ensure_limit(sql, limit=100):
    """Append LIMIT if not already present."""
    if "limit" not in sql.lower():
        sql = sql.rstrip().rstrip(";")
        sql += f" LIMIT {limit};"
    return sql


# ---------------------------------------------------------------------------
# Read-only execution
# ---------------------------------------------------------------------------
def execute_readonly(sql):
    """Execute SQL inside a READ ONLY transaction. Always rolls back."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("BEGIN")
            cur.execute("SET TRANSACTION READ ONLY")
            cur.execute(sql)
            rows = cur.fetchall()
        conn.rollback()
        return rows
    except Exception:
        conn.rollback()
        raise
    finally:
        release_connection(conn)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def ask(question):
    """Full NL2SQL pipeline: question → SQL → results."""
    system_prompt = build_system_prompt()

    raw = generate(prompt=question, system=system_prompt)
    sql = extract_sql(raw)
    sql = _ensure_limit(sql)

    try:
        validate_sql(sql)
        rows = execute_readonly(sql)
        # Convert RealDictRow to plain dicts for JSON serialisation
        results = [dict(r) for r in rows]
        return {
            "question": question,
            "sql": sql,
            "results": results,
            "row_count": len(results),
        }
    except (ValueError, Exception) as exc:
        return {
            "question": question,
            "sql": sql,
            "error": str(exc),
        }
