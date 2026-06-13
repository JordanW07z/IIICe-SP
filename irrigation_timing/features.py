from __future__ import annotations

from typing import List, Union

from .types import Stage

# Canonical stage ordering — used for both training labels and inference.
STAGES = [Stage.NONE, Stage.SMALL_MEDIUM, Stage.MATURE]
STAGE_INDEX = {stage: i for i, stage in enumerate(STAGES)}


def build_features(temp: float, rh: float, stage: Union[str, Stage]) -> List[float]:
    """Build the model feature vector: [temp, rh, stage_index]."""
    stage = Stage.from_str(stage) if isinstance(stage, str) else stage
    return [float(temp), float(rh), STAGE_INDEX[stage]]
