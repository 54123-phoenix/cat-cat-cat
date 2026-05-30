from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas

router = APIRouter(prefix="/api/posts", tags=["posts"])


@router.get("", response_model=List[schemas.PostResponse])
def list_posts(topic: str = "all", skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    if topic not in {"all", "find", "daily", "health", "suggest"}:
        raise HTTPException(status_code=400, detail="Invalid topic")
    return crud.get_posts(db, topic=topic, skip=skip, limit=limit)


@router.post("", response_model=schemas.PostResponse)
def create_post(post: schemas.PostCreate, db: Session = Depends(get_db)):
    if not post.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    if len(post.content) > 500:
        raise HTTPException(status_code=400, detail="Content is too long")
    return crud.create_post(db, post)


@router.post("/{post_id}/like", response_model=schemas.PostResponse)
def like_post(post_id: int, db: Session = Depends(get_db)):
    post = crud.toggle_post_like(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.get("/{post_id}/comments", response_model=List[schemas.CommentResponse])
def list_comments(post_id: int, skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return crud.get_post_comments(db, post_id=post_id, skip=skip, limit=limit)


@router.post("/{post_id}/comments", response_model=schemas.CommentResponse)
def create_comment(post_id: int, comment: schemas.CommentCreate, db: Session = Depends(get_db)):
    if not comment.content.strip():
        raise HTTPException(status_code=400, detail="Comment cannot be empty")
    if len(comment.content) > 300:
        raise HTTPException(status_code=400, detail="Comment is too long")
    created = crud.create_comment(db, post_id=post_id, comment=comment)
    if not created:
        raise HTTPException(status_code=404, detail="Post not found")
    return created
