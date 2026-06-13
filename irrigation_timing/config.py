from __future__ import annotations

from pathlib import Path
from typing import Optional

import yaml

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "oyster.yaml"


def load_config(path: Optional[str] = None) -> dict:
    """Load the species/agronomy config. Defaults to config/oyster.yaml."""
    cfg_path = Path(path) if path else DEFAULT_CONFIG_PATH
    if not cfg_path.exists():
        raise FileNotFoundError(f"Config not found: {cfg_path}. Run from the project root.")
    with open(cfg_path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)
