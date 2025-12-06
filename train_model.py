#!/usr/bin/env python3
"""
Standalone model training script
Run from project root: python train_model.py
"""
import sys
from pathlib import Path

# Add ml-service to path
ml_service_dir = Path(__file__).parent / "ml-service"
sys.path.insert(0, str(ml_service_dir.parent))

# Now import ml_service modules
from ml_service.models.trainer import main

if __name__ == "__main__":
    main()





