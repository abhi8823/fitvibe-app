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
def register_user(email: str, password: str) -> int:
    """
    Registers a new user. 
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
        cursor.execute(
            "INSERT INTO users (email, password_hash, salt) VALUES (?, ?, ?)",
            (email, password_hash, salt)
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
