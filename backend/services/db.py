import os
import sqlite3
import hashlib
import json
from datetime import datetime

# Database file path (saves in the backend directory)
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fitvibe.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Returns dict-like rows
    return conn

def init_db():
    """Initializes the SQLite database tables if they do not exist."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create saved_plans table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS saved_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        goal TEXT NOT NULL,
        metrics_summary TEXT NOT NULL,
        plan_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # Create weight_logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS weight_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        weight REAL NOT NULL,
        log_date TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    # Create daily_logs table (food/workout log)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS daily_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL, -- 'food' or 'workout'
        description TEXT NOT NULL,
        calories INTEGER NOT NULL,
        log_date TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    # Dynamic schema migration: add recovery_question and recovery_answer to users if missing
    cursor.execute("PRAGMA table_info(users)")
    columns = [row["name"] for row in cursor.fetchall()]
    if "recovery_question" not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN recovery_question TEXT")
    if "recovery_answer" not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN recovery_answer TEXT")

    conn.commit()
    conn.close()
    print(f"Database initialized successfully at: {DB_PATH}")


# Call init_db immediately when backend loads to ensure tables are ready
init_db()

# Password Hashing Utilities
def hash_password(password: str, salt: str = None) -> tuple:
    """
    Hashes a password with SHA-256 and salt.
    Returns (hashed_password, salt).
    """
    if not salt:
        salt = os.urandom(16).hex()
    
    # Hash combo of password + salt
    hashed = hashlib.sha256((password + salt).encode("utf-8")).hexdigest()
    return hashed, salt

# Auth Operations
def register_user(email: str, password: str, recovery_question: str = None, recovery_answer: str = None) -> int:
    """
    Registers a new user with recovery question/answer. 
    Returns the user_id if successful, or raises ValueError.
    """
    email = email.strip().lower()
    if not email or not password:
        raise ValueError("Email and password cannot be empty.")
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if user already exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            raise ValueError("An account with this email already exists.")
            
        # Hash password and insert user
        password_hash, salt = hash_password(password)
        answer_hash, _ = hash_password(recovery_answer.strip().lower(), salt) if recovery_answer else (None, None)
        
        cursor.execute(
            "INSERT INTO users (email, password_hash, salt, recovery_question, recovery_answer) VALUES (?, ?, ?, ?, ?)",
            (email, password_hash, salt, recovery_question, answer_hash)
        )
        conn.commit()
        user_id = cursor.lastrowid
        return user_id
    finally:
        conn.close()


def login_user(email: str, password: str) -> dict:
    """
    Authenticates a user.
    Returns a dict with user details if successful, or raises ValueError.
    """
    email = email.strip().lower()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id, password_hash, salt FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        
        if not user:
            raise ValueError("Invalid email or password.")
            
        user_id, stored_hash, salt = user["id"], user["password_hash"], user["salt"]
        computed_hash, _ = hash_password(password, salt)
        
        if computed_hash != stored_hash:
            raise ValueError("Invalid email or password.")
            
        return {"id": user_id, "email": email}
    finally:
        conn.close()

# Saved Plans Operations
def save_plan(user_id: int, goal: str, metrics: dict, plan_text: str) -> int:
    """Saves a generated fitness blueprint for the user."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        metrics_json = json.dumps(metrics)
        cursor.execute(
            "INSERT INTO saved_plans (user_id, goal, metrics_summary, plan_text) VALUES (?, ?, ?, ?)",
            (user_id, goal, metrics_json, plan_text)
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()

def get_saved_plans(user_id: int) -> list:
    """Retrieves all saved blueprints for a user."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "SELECT id, goal, metrics_summary, plan_text, created_at FROM saved_plans WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        rows = cursor.fetchall()
        
        plans = []
        for row in rows:
            plans.append({
                "id": row["id"],
                "goal": row["goal"],
                "metrics": json.loads(row["metrics_summary"]),
                "plan_text": row["plan_text"],
                "created_at": row["created_at"]
            })
        return plans
    finally:
        conn.close()

def delete_plan(user_id: int, plan_id: int):
    """Deletes a saved blueprint for a specific user to ensure ownership verification."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM saved_plans WHERE id = ? AND user_id = ?", (plan_id, user_id))
        conn.commit()
    finally:
        conn.close()

# Weight Tracking Operations
def log_weight(user_id: int, weight: float, log_date: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if record exists for this date, if so update, else insert
        cursor.execute("SELECT id FROM weight_logs WHERE user_id = ? AND log_date = ?", (user_id, log_date))
        exists = cursor.fetchone()
        if exists:
            cursor.execute("UPDATE weight_logs SET weight = ? WHERE id = ?", (weight, exists["id"]))
        else:
            cursor.execute("INSERT INTO weight_logs (user_id, weight, log_date) VALUES (?, ?, ?)", (user_id, weight, log_date))
        conn.commit()
    finally:
        conn.close()

def get_weight_history(user_id: int) -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT weight, log_date FROM weight_logs WHERE user_id = ? ORDER BY log_date ASC", (user_id,))
        rows = cursor.fetchall()
        return [{"weight": r["weight"], "date": r["log_date"]} for r in rows]
    finally:
        conn.close()

# Daily Food & Activity Logging Operations
def add_daily_log(user_id: int, log_type: str, description: str, calories: int, log_date: str) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO daily_logs (user_id, type, description, calories, log_date) VALUES (?, ?, ?, ?, ?)",
            (user_id, log_type, description, calories, log_date)
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()

def get_daily_logs(user_id: int, log_date: str) -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT id, type, description, calories FROM daily_logs WHERE user_id = ? AND log_date = ?",
            (user_id, log_date)
        )
        rows = cursor.fetchall()
        return [{"id": r["id"], "type": r["type"], "description": r["description"], "calories": r["calories"]} for r in rows]
    finally:
        conn.close()

def delete_daily_log(user_id: int, log_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM daily_logs WHERE id = ? AND user_id = ?", (log_id, user_id))
        conn.commit()
    finally:
        conn.close()

# Password Reset with Recovery Question Operations
def get_recovery_question(email: str) -> str:
    """Retrieves the recovery question for a given email."""
    email = email.strip().lower()
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT recovery_question FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        if not row:
            raise ValueError("No account found with this email.")
        return row["recovery_question"] or "What is your recovery answer?"
    finally:
        conn.close()

def reset_password_with_recovery(email: str, answer: str, new_password: str):
    """Verifies recovery answer and updates password."""
    email = email.strip().lower()
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, salt, recovery_answer FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        if not row:
            raise ValueError("No account found with this email.")
            
        user_id, salt, stored_answer_hash = row["id"], row["salt"], row["recovery_answer"]
        if not stored_answer_hash:
            raise ValueError("No recovery question configured for this account.")
            
        # Verify answer case-insensitively
        computed_answer_hash, _ = hash_password(answer.strip().lower(), salt)
        if computed_answer_hash != stored_answer_hash:
            raise ValueError("Incorrect recovery answer.")
            
        # Update user password
        new_hash, _ = hash_password(new_password, salt)
        cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user_id))
        conn.commit()
    finally:
        conn.close()

def delete_user(user_id: int):
    """Permanently deletes a user from the users table, cascading all associated plans and logs."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
    finally:
        conn.close()




