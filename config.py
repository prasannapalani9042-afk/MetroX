import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, 'instance', 'metrox.db')
SECRET_KEY = os.environ.get('METROX_SECRET_KEY', 'metrox-college-project-secret-key-change-me')
