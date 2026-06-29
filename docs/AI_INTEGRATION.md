# AI Integration Contract

This document defines the stable AI integration boundary for the campus cat archive. The backend already includes a DINOv2-style local model loading and embedding matching path. Future AI work should harden observability, model health, threshold calibration, and optional new-cat advisory review without breaking the product workflow.

## Design Principle

AI is a replaceable service boundary, not business logic. API routers and CRUD modules should call the adapter below instead of importing model SDKs directly:

```text
cat-backend/app/services/ai.py
```

The current production-facing AI capability is:

- Cat recognition: identify a known cat from an uploaded image, or return a graceful fallback state when model assets are unavailable.

New-cat discovery review remains a human-admin workflow today. AI advisory review can be added later, but it must stay advisory and must not create, merge, or reject cats without admin action.

## Current Adapter Function

```python
recognize_cat_image(image_bytes: bytes, filename: str = "") -> RecognizeResponse
```

Used by:

```text
POST /api/recognize
```

Implementation boundary:

```text
cat-backend/app/services/ai.py
cat-backend/app/services/model_loader.py
models/finetuned_best.pt
embeddings/cat_embeddings.json
```

If PyTorch, model weights, or reference embeddings are unavailable, the adapter returns a controlled `unavailable` or `unknown` response instead of raising an unhandled server error.

## Recognition API Contract

Endpoint:

```text
POST /api/recognize
Content-Type: multipart/form-data
file: image
```

Response shape:

```json
{
  "status": "confirmed | uncertain | unknown | unavailable",
  "confidence": 0.92,
  "cat_id": 1,
  "cat_name": "小白",
  "candidates": [
    {
      "cat_id": 1,
      "cat_name": "小白",
      "confidence": 0.68
    }
  ]
}
```

Status semantics:

- `confirmed`: high-confidence match to one existing cat.
- `uncertain`: possible matches exist, but the user should choose from candidates.
- `unknown`: no reliable existing-cat match; the user may submit a new-cat discovery.
- `unavailable`: model assets, dependencies, or inference failed; the user should retry later or submit a manual clue.

Thresholds are configured through backend settings:

```text
RECOGNIZE_THRESHOLD_CONFIRMED
RECOGNIZE_THRESHOLD_UNCERTAIN
```

Current defaults are tuned for demonstration data and should be recalibrated with real campus photos before production deployment.

## New-Cat Discovery Contract

Endpoint:

```text
POST /api/discoveries
Content-Type: multipart/form-data
file: image optional
location_name: string optional
latitude: float optional
longitude: float optional
note: string optional
```

Important rule:

Human admin review is the source of truth for creating, merging, or rejecting cat records.

Admin review endpoint:

```text
POST /api/discoveries/{id}/review
Authorization: Bearer <admin-token>
```

Review actions:

- `approve`: create a new cat record, attach the discovery image as a reference photo, issue the new-cat finder badge.
- `merge`: associate the discovery with an existing cat.
- `reject`: mark the discovery as invalid.

Future AI advisory review may add suggested name, color, duplicate risk, and image-quality summary, but those fields must not become the authority for record creation.

## Model Hardening Pipeline

### Recognition

1. Validate image format and size before inference.
2. Load model weights and reference embeddings through `model_loader.py`.
3. Extract an embedding from the uploaded image.
4. Compare it with known cat embeddings.
5. Convert similarity scores into the four-state response.
6. Log latency, failure reason, and fallback status server-side.

### Production Readiness

1. Keep `/api/system/health` checking weight file, embedding file, dependency availability, thresholds, and optional warm model load.
2. Expand threshold calibration with confirmed campus-cat photo sets.
3. Add structured logs for inference latency and unavailable reasons.
4. Keep `/api/recognize` response shape stable.
5. Keep model errors as graceful fallback responses, not unhandled 500 errors.
6. Keep human admin approval required for new-cat creation.

## Data Inputs Available Today

- Cat reference photos: `cat_images.image_path`
- User sightings: `sightings.image_path`, location, confidence
- New-cat discoveries: `cat_discoveries.image_path`, note, location
- Cat metadata: name, color, personality, story, location

## Change Checklist

When changing the AI layer:

- Keep model code behind `cat-backend/app/services/ai.py` or a service imported by it.
- Do not import model SDKs in API routers or CRUD modules.
- Update this document if status semantics, thresholds, or fallback behavior changes.
- Add backend tests for success, uncertain, unknown, and unavailable paths.
- Run full harness before marking an AI milestone complete.
