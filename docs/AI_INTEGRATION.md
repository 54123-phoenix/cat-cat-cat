# AI Integration Contract

This document defines the stable AI integration boundary for the campus cat archive. The product workflow must remain stable while the mock implementation is replaced by real model services.

## Design Principle

AI is not only used for image recognition. The system exposes two independent AI capabilities:

- Cat recognition: identify a known cat from an uploaded image.
- New-cat discovery review: screen possible new cats before human admin review.

All AI-specific code should live behind:

```text
cat-backend/app/services/ai.py
```

Business code should call this adapter instead of importing model SDKs directly.

## Current Adapter Functions

```python
recognize_cat_image(filename: str, image_path: Optional[str] = None) -> RecognizeResponse
```

Used by:

```text
POST /api/recognize
```

```python
review_new_cat_discovery(image_path: Optional[str], note: Optional[str]) -> DiscoveryAIReview
```

> 未接入，预留。当前 `review_new_cat_discovery` 与 `DiscoveryAIReview` 已从 `app/services/ai.py` 移除（死代码清理）。AI 初审待后续里程碑接入审核流程。

Used by:

```text
POST /api/discoveries
```

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
  "status": "confirmed | uncertain | unknown",
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
- `uncertain`: possible matches exist, but human user should choose from candidates.
- `unknown`: no reliable existing-cat match; user may submit a new-cat discovery.

Suggested thresholds:

- `confirmed`: top1 confidence >= 0.45 (THRESHOLD_CONFIRMED).
- `uncertain`: top1 confidence >= 0.30 (THRESHOLD_UNCERTAIN) but below confirmed threshold.
- `unknown`: no candidate above 0.30 or image quality is insufficient.

These thresholds are defined in `cat-backend/app/services/ai.py` (THRESHOLD_CONFIRMED=0.45, THRESHOLD_UNCERTAIN=0.30) and can be tuned with real data.

## New-Cat Discovery AI Contract

Endpoint using the AI review indirectly:

```text
POST /api/discoveries
Content-Type: multipart/form-data
file: image optional
location_name: string optional
latitude: float optional
longitude: float optional
note: string optional
```

AI adapter output:

```json
{
  "ai_status": "needs_review",
  "ai_confidence": 0.72,
  "ai_summary": "AI 初审：疑似未入库校园猫，建议猫协结合地点与照片复核。",
  "suggested_name": "新朋友",
  "suggested_color": "橘白"
}
```

Important rule:

AI review is advisory only. Human admin review is the source of truth for creating, merging, or rejecting cat records.

Admin review endpoint:

```text
POST /api/discoveries/{id}/review
Authorization: Bearer <admin-token>
```

Review actions:

- `approve`: create a new cat record, attach the discovery image as a reference photo, issue `new_cat_finder` badge.
- `merge`: associate the discovery with an existing cat.
- `reject`: mark the discovery as invalid.

## Recommended Real Model Pipeline

### Recognition

1. Validate image format and size.
2. Detect cat region using YOLO or equivalent detector.
3. Crop or normalize the detected region.
4. Extract embedding using CLIP or a fine-tuned visual encoder.
5. Search existing cat embeddings with FAISS.
6. Convert similarity scores into the three-state response.

### New-Cat Review

1. Check whether the image likely contains a cat.
2. Search for similar existing cats to avoid duplicate records.
3. Infer visible attributes, such as coat color and notable marks.
4. Generate a short admin-facing review summary.
5. Return `needs_review` unless confidence is clearly invalid.

## Data Inputs Available Today

- Cat reference photos: `cat_images.image_path`
- User sightings: `sightings.image_path`, location, confidence
- New-cat discoveries: `cat_discoveries.image_path`, note, location
- Cat metadata: name, color, personality, story, location

## Replacement Checklist

When replacing mock AI with a real service:

- Keep `/api/recognize` response shape unchanged.
- Keep `/api/discoveries` response fields unchanged.
- Do not import model SDKs in API routers or CRUD modules.
- Add model errors as graceful fallback responses, not unhandled 500 errors.
- Log model latency and failure reason server-side.
- Keep human admin approval required for new-cat creation.
