"""SQLite vote settlement. Vote, reward receipt and XP commit together.

A later change of vote or consensus neither revokes nor reissues a reward.
Historical XP has no receipts and is intentionally not reconstructed.
"""
from sqlalchemy import func, update
from sqlalchemy.dialects.sqlite import insert

from app import models, crud


def settle_vote(db, sighting_id: int, user_id: int, cat_id: int):
    try:
        # The first write serializes concurrent SQLite writers before counting.
        db.execute(insert(models.SightingVote).values(
            sighting_id=sighting_id, user_id=user_id, cat_id=cat_id,
        ).on_conflict_do_update(
            index_elements=['sighting_id', 'user_id'], set_={'cat_id': cat_id},
        ))
        sighting = db.get(models.Sighting, sighting_id, populate_existing=True)
        votes = dict(db.query(models.SightingVote.cat_id, func.count(models.SightingVote.id))
                     .filter(models.SightingVote.sighting_id == sighting_id)
                     .group_by(models.SightingVote.cat_id).all())
        ranking = sorted(votes.items(), key=lambda item: (-item[1], item[0]))
        # A tied lead is not a consensus.
        confirmed = bool(ranking and ranking[0][1] >= 3 and
                         (len(ranking) == 1 or ranking[0][1] > ranking[1][1]))
        changed = False
        if confirmed:
            winner = ranking[0][0]
            changed = sighting.cat_id != winner or sighting.grade != 'research_grade'
            sighting.cat_id = winner
            sighting.grade = 'research_grade'
            voters = db.query(models.SightingVote.user_id).filter(
                models.SightingVote.sighting_id == sighting_id,
                models.SightingVote.cat_id == winner,
            ).all()
            for (voter_id,) in voters:
                receipt = db.execute(insert(models.SightingVoteReward).values(
                    sighting_id=sighting_id, user_id=voter_id, cat_id=winner, amount=3,
                ).on_conflict_do_nothing(index_elements=['sighting_id', 'user_id']))
                if receipt.rowcount:
                    db.execute(update(models.User).where(models.User.id == voter_id)
                               .values(xp=func.coalesce(models.User.xp, 0) + 3))
                    voter = db.get(models.User, voter_id, populate_existing=True)
                    voter.level = crud.compute_level(voter.xp)
        grade = sighting.grade or 'casual'
        db.commit()
        return votes, confirmed, grade, changed
    except Exception:
        db.rollback()
        raise
