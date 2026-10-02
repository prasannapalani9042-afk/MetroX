# MetroX — Flask + SQLite (same UI as the GitHub Pages version)

This version keeps the original MetroX frontend design and page structure, but adds a Python Flask backend and SQLite database similar to the Hotel Management System project.

## Stack
- HTML / CSS / JavaScript — original MetroX UI
- Python + Flask — backend/API
- SQLite — users and persistent user data
- Werkzeug password hashing
- No `venv` required

## Run on Windows
1. Extract this ZIP.
2. Open the folder.
3. Double-click `run.bat`.
4. It installs the required packages, initializes SQLite, starts Flask, and opens:
   `http://127.0.0.1:5000/auth.html`

Manual commands:
```text
pip install -r requirements.txt
python seed.py
python app.py
```

## Demo accounts
- User: `demo@metrox.com` / `metrox123`
- Admin: `admin@metrox.com` / `admin123`

## Database
The database is created at `instance/metrox.db`.

Stored server-side:
- users, roles, password hashes
- favorites
- journey history
- admin-added stations

Forgot password uses a **demo OTP** shown on the page; no real SMS/email is sent.

## Important
GitHub Pages can host the original static frontend, but it cannot run this Flask + SQLite backend. For the full-stack version, run the Flask app locally or deploy the Python backend to a Python-capable host.
