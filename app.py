import os, json, sqlite3, secrets, time
from datetime import timedelta
from functools import wraps
from flask import Flask, jsonify, request, session, redirect, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'instance', 'metrox.db')
FRONTEND_DIR = BASE_DIR
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

app = Flask(__name__, static_folder=None)
app.secret_key = os.environ.get('METROX_SECRET_KEY', 'metrox-college-project-secret-key-change-me')
app.permanent_session_lifetime = timedelta(days=7)


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = db()
    conn.executescript('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_storage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, key),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS password_otps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        otp TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    ''')
    conn.commit()
    # Seed demo accounts.
    for name, email, phone, password, role in [
        ('Demo User', 'demo@metrox.com', '9999999999', 'metrox123', 'user'),
        ('Admin', 'admin@metrox.com', '8888888888', 'admin123', 'admin'),
    ]:
        exists = conn.execute('SELECT id FROM users WHERE email=?', (email,)).fetchone()
        if not exists:
            conn.execute('INSERT INTO users(name,email,phone,password_hash,role) VALUES(?,?,?,?,?)',
                         (name, email, phone, generate_password_hash(password), role))
    conn.commit()
    conn.close()


def current_user():
    uid = session.get('user_id')
    if not uid:
        return None
    conn = db()
    row = conn.execute('SELECT * FROM users WHERE id=?', (uid,)).fetchone()
    conn.close()
    return row


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user():
            return jsonify({'ok': False, 'error': 'Login required'}), 401
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user:
            return jsonify({'ok': False, 'error': 'Login required'}), 401
        if user['role'] != 'admin':
            return jsonify({'ok': False, 'error': 'Admin access only'}), 403
        return fn(*args, **kwargs)
    return wrapper


def public_user(row):
    return {'id': row['id'], 'name': row['name'], 'email': row['email'], 'phone': row['phone'], 'role': row['role']}


@app.get('/')
def root():
    return redirect('/auth.html')


@app.post('/api/auth/login')
def api_login():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    conn = db()
    row = conn.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
    conn.close()
    if not row or not check_password_hash(row['password_hash'], password):
        return jsonify({'ok': False, 'error': 'Invalid email or password.'}), 401
    session.permanent = True
    session['user_id'] = row['id']
    return jsonify({'ok': True, 'user': public_user(row)})


@app.post('/api/auth/register')
def api_register():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    password = data.get('password', '')
    if not name or not email or len(phone) < 10 or len(password) < 4:
        return jsonify({'ok': False, 'error': 'Enter valid details. Password must be 4+ characters.'}), 400
    conn = db()
    if conn.execute('SELECT id FROM users WHERE email=?', (email,)).fetchone():
        conn.close()
        return jsonify({'ok': False, 'error': 'An account already exists for this email. Please login instead.'}), 409
    cur = conn.execute('INSERT INTO users(name,email,phone,password_hash,role) VALUES(?,?,?,?,?)',
                       (name, email, phone, generate_password_hash(password), 'user'))
    conn.commit()
    uid = cur.lastrowid
    row = conn.execute('SELECT * FROM users WHERE id=?', (uid,)).fetchone()
    conn.close()
    session.permanent = True
    session['user_id'] = uid
    return jsonify({'ok': True, 'user': public_user(row)})


@app.post('/api/auth/logout')
def api_logout():
    session.clear()
    return jsonify({'ok': True})


@app.post('/api/auth/request-otp')
def api_request_otp():
    data = request.get_json(silent=True) or {}
    method = data.get('method')
    value = data.get('value', '').strip().lower()
    conn = db()
    if method == 'sms':
        row = conn.execute('SELECT * FROM users WHERE phone=?', (value,)).fetchone()
    else:
        row = conn.execute('SELECT * FROM users WHERE email=?', (value,)).fetchone()
    if not row:
        conn.close()
        return jsonify({'ok': False, 'error': 'No account found with that contact.'}), 404
    otp = f'{secrets.randbelow(900000) + 100000}'
    expires = int(time.time()) + 600
    conn.execute('DELETE FROM password_otps WHERE user_id=?', (row['id'],))
    conn.execute('INSERT INTO password_otps(user_id,otp,expires_at) VALUES(?,?,?)', (row['id'], otp, expires))
    conn.commit(); conn.close()
    # This is a college-project demo: no real SMS/email is sent.
    return jsonify({'ok': True, 'email': row['email'], 'display': f'SMS to {row["phone"]}' if method == 'sms' else f'email to {row["email"]}', 'demo_otp': otp})


@app.post('/api/auth/reset-password')
def api_reset_password():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    otp = data.get('otp', '').strip()
    password = data.get('password', '')
    if len(password) < 4:
        return jsonify({'ok': False, 'error': 'Password must be at least 4 characters.'}), 400
    conn = db()
    row = conn.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
    record = conn.execute('SELECT * FROM password_otps WHERE user_id=? ORDER BY id DESC LIMIT 1', (row['id'],)).fetchone() if row else None
    if not row or not record or record['otp'] != otp or record['expires_at'] < int(time.time()):
        conn.close()
        return jsonify({'ok': False, 'error': 'Incorrect or expired OTP.'}), 400
    conn.execute('UPDATE users SET password_hash=? WHERE id=?', (generate_password_hash(password), row['id']))
    conn.execute('DELETE FROM password_otps WHERE user_id=?', (row['id'],))
    conn.commit(); conn.close()
    return jsonify({'ok': True})


@app.get('/api/bootstrap')
@login_required
def bootstrap():
    user = current_user()
    conn = db()
    rows = conn.execute('SELECT key,value FROM user_storage WHERE user_id=?', (user['id'],)).fetchall()
    conn.close()
    storage = {}
    for row in rows:
        storage[row['key']] = row['value']
    # Safe user directory used only by the original MetroX shell to refresh role/name.
    conn = db()
    users = conn.execute('SELECT name,email,phone,role FROM users').fetchall()
    conn.close()
    safe_users = {r['email']: {'name': r['name'], 'phone': r['phone'], 'role': r['role']} for r in users}
    return jsonify({'ok': True, 'session': public_user(user), 'storage': storage, 'users': safe_users})


@app.post('/api/storage')
@login_required
def save_storage():
    data = request.get_json(silent=True) or {}
    key = data.get('key')
    value = data.get('value')
    allowed = {'metroFavs', 'metroHistory', 'metroAdminStations'}
    if key not in allowed:
        return jsonify({'ok': False, 'error': 'Unsupported storage key'}), 400
    # Admin station data is global, but it is stored with the admin account in this project.
    conn = db()
    conn.execute('''INSERT INTO user_storage(user_id,key,value,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP)
                    ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP''',
                 (current_user()['id'], key, json.dumps(value) if not isinstance(value, str) else value))
    conn.commit(); conn.close()
    return jsonify({'ok': True})


@app.delete('/api/storage/<key>')
@login_required
def delete_storage(key):
    if key not in {'metroFavs', 'metroHistory', 'metroAdminStations'}:
        return jsonify({'ok': False}), 400
    conn = db(); conn.execute('DELETE FROM user_storage WHERE user_id=? AND key=?', (current_user()['id'], key)); conn.commit(); conn.close()
    return jsonify({'ok': True})


@app.get('/api/session')
def api_session():
    user = current_user()
    return jsonify({'authenticated': bool(user), 'user': public_user(user) if user else None})


@app.route('/<path:path>')
def frontend(path):
    # API paths are handled above. Everything else is the original MetroX frontend.
    full = os.path.join(FRONTEND_DIR, path)
    if os.path.isfile(full):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, 'auth.html')


init_db()

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0',port=int(os.environ.get('PORT',5000)), debug=False)
