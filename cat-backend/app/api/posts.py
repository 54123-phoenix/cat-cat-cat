import os
import uuid
from typing import List

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas, models
from app.api.auth import require_auth
from app.models import User
from app.ratelimit import limit
from app.config import settings

router = APIRouter(prefix="/api/posts", tags=["posts"])


class HandleAction(BaseModel):
    action: str = "dismiss"

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
POSTS_UPLOAD = os.path.join(UPLOAD_DIR, "posts")
os.makedirs(POSTS_UPLOAD, exist_ok=True)

MAX_UPLOAD_SIZE = 10 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _validate_upload(file: UploadFile):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}. Allowed: {', '.join(sorted(ALLOWED_IMAGE_TYPES))}")


def _save_images(files: List[UploadFile]) -> List[str]:
    paths = []
    for file in files:
        _validate_upload(file)
        ext = os.path.splitext(file.filename or ".jpg")[1] or ".jpg"
        name = f"{uuid.uuid4().hex}{ext}"
        dest = os.path.join(POSTS_UPLOAD, name)
        content = file.file.read()
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=400, detail=f"File too large. Max size: {MAX_UPLOAD_SIZE // (1024 * 1024)}MB")
        with open(dest, "wb") as f:
            f.write(content)
        paths.append(f"/uploads/posts/{name}")
    return paths


@router.get("", response_model=schemas.PaginatedPostsResponse)
def list_posts(
    topic: str = "all",
    keyword: str = None,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    if topic not in {"all", "find", "daily", "health", "suggest"}:
        raise HTTPException(status_code=400, detail="Invalid topic")
    total = crud.count_posts(db, topic=topic, keyword=keyword)
    if keyword and keyword.strip():
        items = crud.search_posts(db, keyword=keyword.strip(), skip=skip, limit=limit, current_user_id=user.id)
    else:
        items = crud.get_posts(db, topic=topic, skip=skip, limit=limit, current_user_id=user.id)
    has_more = (skip + limit) < total
    return schemas.PaginatedPostsResponse(items=items, total=total, has_more=has_more)


@router.post("", response_model=schemas.PostResponse)
@limit(f"{settings.RATE_POST_PER_MIN}/minute")
def create_post(
    request: Request,
    topic: str = Form("daily"),
    content: str = Form(...),
    tags: str = Form("[]"),
    relatedCatId: str = Form(None),
    postType: str = Form("discussion"),
    pollOptions: str = Form("[]"),
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    if not content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    if len(content) > 500:
        raise HTTPException(status_code=400, detail="Content is too long")

    import json
    tag_list = json.loads(tags) if tags else []
    rel_id = int(relatedCatId) if relatedCatId and relatedCatId != "null" else None
    poll_option_list = json.loads(pollOptions) if pollOptions else []

    image_paths = _save_images(files) if files else []

    post_data = schemas.PostCreate(
        topic=topic,
        content=content.strip(),
        tags=tag_list,
        relatedCatId=rel_id,
        postType=postType,
        pollOptions=poll_option_list,
    )
    try:
        return crud.create_post(db, post_data, user.id, image_paths)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{post_id}", response_model=schemas.PostResponse)
def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return crud._serialize_post(post, user.id)


@router.put("/{post_id}", response_model=schemas.PostResponse)
def update_post(
    post_id: int,
    post_update: schemas.PostUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    result = crud.update_post(db, post_id, post_update, user.id)
    if not result:
        raise HTTPException(status_code=403, detail="Not authorized or post not found")
    return result


@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    is_admin = user.role == "admin"
    ok = crud.delete_post(db, post_id, user.id, is_admin)
    if not ok:
        raise HTTPException(status_code=403, detail="Not authorized or post not found")
    return {"ok": True}


@router.post("/{post_id}/like", response_model=schemas.PostResponse)
def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    post = crud.toggle_post_like(db, post_id, user.id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    # Notify post author if someone else liked
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if db_post and db_post.user_id != user.id:
        like_record = db.query(models.PostLike).filter(
            models.PostLike.post_id == post_id,
            models.PostLike.user_id == user.id,
        ).first()
        if like_record:
            crud.create_notification(
                db, user_id=db_post.user_id, notification_type="post_like",
                title="有人赞了你的帖子", content=f"{user.nickname} 赞了你的帖子",
                related_id=post_id, related_type="post",
            )
    return post


@router.get("/{post_id}/comments", response_model=List[schemas.CommentResponse])
def list_comments(
    post_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    return crud.get_comments(db, post_id=post_id, skip=skip, limit=limit)


@router.post("/{post_id}/comments", response_model=schemas.CommentResponse)
def create_comment(
    post_id: int,
    comment: schemas.CommentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    if not comment.content.strip():
        raise HTTPException(status_code=400, detail="Comment cannot be empty")
    if len(comment.content) > 300:
        raise HTTPException(status_code=400, detail="Comment is too long")
    created = crud.create_comment(db, post_id=post_id, comment=comment, user_id=user.id)
    if not created:
        raise HTTPException(status_code=404, detail="Post not found")
    return created


@router.post("/{post_id}/report")
def report_post(
    post_id: int,
    report: schemas.ReportCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    ok = crud.report_post(db, post_id, user.id, report.reason)
    if not ok:
        raise HTTPException(status_code=400, detail="Already reported or post not found")
    return {"ok": True}


@router.get("/reports", response_model=List[schemas.ReportResponse])
def list_reports(
    status: str = "pending",
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return crud.get_reports(db, status=status, skip=skip, limit=limit)


@router.post("/reports/{report_id}/handle")
def handle_report(
    report_id: int,
    body: HandleAction,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    ok = crud.handle_report(db, report_id, body.action, user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}


class PollVoteRequest(BaseModel):
    option_index: int


@router.post("/{post_id}/poll-vote", response_model=schemas.PostResponse)
def poll_vote(
    post_id: int,
    body: PollVoteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    result = crud.poll_vote(db, post_id, user.id, body.option_index)
    if not result:
        raise HTTPException(status_code=400, detail="投票失败：帖子不存在、非投票帖或选项无效")
    return result


class AcceptAnswerRequest(BaseModel):
    comment_id: int


@router.post("/{post_id}/accept-answer", response_model=schemas.PostResponse)
def accept_answer(
    post_id: int,
    body: AcceptAnswerRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    is_admin = user.role == "admin"
    result = crud.accept_answer(db, post_id, body.comment_id, user.id, is_admin)
    if not result:
        raise HTTPException(status_code=403, detail="无法采纳：权限不足或帖子/评论不存在")
    return result
