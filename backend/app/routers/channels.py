from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/channels", tags=["channels"])


@router.get("/mine", response_model=list[schemas.ChannelRead])
def list_my_channels(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.Channel]:
    member_channel_ids = [
        row[0]
        for row in db.query(models.ChannelMember.channel_id)
        .filter(models.ChannelMember.user_id == current_user.id)
        .all()
    ]
    if not member_channel_ids:
        return []
    return (
        db.query(models.Channel)
        .filter(models.Channel.id.in_(member_channel_ids))
        .order_by(models.Channel.created_at.desc())
        .all()
    )


@router.post("/{channel_id}/invite", status_code=status.HTTP_204_NO_CONTENT)
def invite_to_channel(
    channel_id: str,
    payload: schemas.ChannelInviteRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Response:
    channel = db.get(models.Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")

    # Any member can invite
    is_member = (
        db.query(models.ChannelMember)
        .filter(models.ChannelMember.channel_id == channel_id, models.ChannelMember.user_id == current_user.id)
        .first()
        is not None
    )
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of channel")

    invitee = db.query(models.User).filter(models.User.email == str(payload.email).strip()).first()
    if not invitee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing = (
        db.query(models.ChannelMember)
        .filter(models.ChannelMember.channel_id == channel_id, models.ChannelMember.user_id == invitee.id)
        .first()
    )
    if existing:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    membership = models.ChannelMember(channel_id=channel_id, user_id=invitee.id, role="member")
    db.add(membership)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{channel_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_channel(
    channel_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Response:
    channel = db.get(models.Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")

    membership = (
        db.query(models.ChannelMember)
        .filter(models.ChannelMember.channel_id == channel_id, models.ChannelMember.user_id == current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of channel")

    # Block leaving if sole owner
    if membership.role == "owner":
        owner_count = (
            db.query(models.ChannelMember)
            .filter(models.ChannelMember.channel_id == channel_id, models.ChannelMember.role == "owner")
            .count()
        )
        if owner_count <= 1:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Sole owner cannot leave")

    db.delete(membership)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{channel_id}/kick", status_code=status.HTTP_204_NO_CONTENT)
def kick_from_channel(
    channel_id: str,
    payload: schemas.ChannelKickRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Response:
    channel = db.get(models.Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")

    # Owner only can kick
    is_owner = (
        db.query(models.ChannelMember)
        .filter(
            models.ChannelMember.channel_id == channel_id,
            models.ChannelMember.user_id == current_user.id,
            models.ChannelMember.role == "owner",
        )
        .first()
        is not None
    )
    if not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    target = (
        db.query(models.ChannelMember)
        .filter(models.ChannelMember.channel_id == channel_id, models.ChannelMember.user_id == payload.user_id)
        .first()
    )
    if not target:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    # Prevent kicking the sole owner
    if target.role == "owner":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot remove owner")

    db.delete(target)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)

