"""
Logging utilities
"""
import logging
import sys
from pathlib import Path

from ml_service.config import LOG_LEVEL

# Create logs directory
LOGS_DIR = Path(__file__).parent.parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

# Configure logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(LOGS_DIR / "ml_service.log"),
        logging.StreamHandler(sys.stdout),
    ],
)

logger = logging.getLogger("ml_service")





