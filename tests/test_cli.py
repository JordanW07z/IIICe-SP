import json
import irrigation_timing.cli as cli


def test_cli_train_then_report(tmp_path, monkeypatch, capsys):
    model_path = tmp_path / "m.pkl"
    # redirect the module-level MODEL_PATH used by both train and report
    monkeypatch.setattr(cli, "MODEL_PATH", model_path)

    cli.main(["train", "--n", "1500"])
    out = json.loads(capsys.readouterr().out)
    assert out["trained"] is True
    assert model_path.exists()

    cli.main(["report", "--stage", "small_medium"])
    report = json.loads(capsys.readouterr().out)
    assert "optimum" in report and "best_window" in report and "live" in report
    assert 20.0 <= report["optimum"]["temp"] <= 28.0
