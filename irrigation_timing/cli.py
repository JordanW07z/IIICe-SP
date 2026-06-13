from __future__ import annotations

import argparse
import json
from typing import List, Optional

from .config import load_config
from .decision import best_window, decide_now
from .model.predict import load_model, optimum
from .model.train import MODEL_PATH, train
from .sensors.synthetic import SyntheticSensor, diurnal_profile
from .types import Stage


def main(argv: Optional[List[str]] = None) -> None:
    parser = argparse.ArgumentParser(description="SpotShrooms irrigation-timing AI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_train = sub.add_parser("train", help="train the growth model on synthetic data")
    p_train.add_argument("--n", type=int, default=4000)

    p_report = sub.add_parser("report", help="print optimum, best window, and live decision")
    p_report.add_argument("--stage", default="small_medium")

    args = parser.parse_args(argv)
    config = load_config()

    if args.cmd == "train":
        _, metrics = train(n=args.n, model_path=MODEL_PATH, config=config)
        print(json.dumps({"trained": True, "metrics": metrics}))
        return

    if args.cmd == "report":
        model = load_model(MODEL_PATH)
        stage = Stage.from_str(args.stage)
        opt = optimum(model, stage)
        profile = [(h, t, r) for h, (t, r) in enumerate(diurnal_profile(config))]
        window = best_window(model, stage, profile, config)
        now = SyntheticSensor(config).read()
        live = decide_now(model, now.temp, now.rh, stage, config, hour=now.ts.hour)
        print(json.dumps(
            {"stage": stage.value, "optimum": opt, "best_window": window,
             "now": {"temp": round(now.temp, 1), "rh": round(now.rh, 1)}, "live": live},
            indent=2,
        ))


if __name__ == "__main__":
    main()
