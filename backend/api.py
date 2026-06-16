import os
import sys

# Ensure backend directory is in the python path so imports are resolved correctly
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from app.main import app
