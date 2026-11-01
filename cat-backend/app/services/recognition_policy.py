"""Pure confirmation policy shared by live inference and offline calibration."""
from dataclasses import dataclass
import math


@dataclass(frozen=True)
class RecognitionPolicy:
    confirmed: float
    uncertain: float
    minimum_margin: float = 0.0

    def __post_init__(self):
        if (not all(math.isfinite(v) for v in (self.confirmed, self.uncertain, self.minimum_margin))
                or not -1 <= self.uncertain < self.confirmed <= 1
                or not 0 <= self.minimum_margin <= 2):
            raise ValueError('Recognition thresholds must be finite, ordered within [-1, 1], with margin in [0, 2]')

    def classify(self, scores):
        if not scores or not all(math.isfinite(v) and -1 <= v <= 1 for v in scores):
            raise ValueError('Expected finite ranked cosine scores')
        if any(a < b for a, b in zip(scores, scores[1:])):
            raise ValueError('Scores must be ordered by distinct identity')
        # A lone gallery identity supplies no evidence of separation. Preserve
        # legacy behavior for zero margin, but require a runner-up otherwise.
        separated = self.minimum_margin == 0 or (len(scores) > 1 and scores[0] - scores[1] >= self.minimum_margin)
        if scores[0] >= self.confirmed and separated:
            return 'confirmed'
        return 'uncertain' if scores[0] >= self.uncertain else 'unknown'
