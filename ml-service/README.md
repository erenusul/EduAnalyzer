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

## Optik tarama ve OMRChecker (isteğe bağlı)

- Varsayılan: dahili OpenCV tabanlı okuma (`template`: `lgs_turkish_212x300`, `lgs_turkish_column_crop`, …).
- **OMRChecker:** `template=lgs_turkish_omrchecker` + ortam değişkeni `OMR_CHECKER_TEMPLATE_JSON` (mutlak yol, OMRChecker `template.json`). Bağımlılıklar: `pip install -r requirements-omrchecker.txt`. Şablon yoksa veya hata olursa otomatik olarak dahili `lgs_turkish_212x300` okuyucuya düşülür.
- **Türkçe sütunu:** `template=lgs_turkish_column_crop` artık crop sonrası önce OMRChecker dener. `OMR_CHECKER_COLUMN_TEMPLATE_JSON` verilmezse vendored `lgs_turkish_column_20q_4pxmm.json` kullanılır; OMR başarısızsa hibrit OpenCV okuyucuya düşer.
- Ayrıntı: `omr_templates/README.md`, `optical.env.example`.





