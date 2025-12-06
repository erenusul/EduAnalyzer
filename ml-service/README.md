# ML Service - Question Classifier

BERTurk-based question classification service for predicting subject and topic of Turkish questions.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Training

Train the model using the question dataset:
```bash
python -m ml_service.models.trainer
```

## Running the API

Start the FastAPI server:
```bash
uvicorn ml_service.api.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`





