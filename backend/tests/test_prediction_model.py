from app.ml.model import MODEL_META, load_or_train, predict


def test_demo_model_changes_risk_for_distinct_feature_sets(tmp_path):
    package = load_or_train(str(tmp_path / "model.pkl"))
    assert package["meta"]["version"] == MODEL_META["version"]

    lower_risk = {
        "metal_area": 5,
        "gate_area": 20,
        "wire_length": 10,
        "layer_count": 1,
        "metal_width": 0.05,
        "spacing": 0.9,
    }
    higher_risk = {
        "metal_area": 82,
        "gate_area": 7,
        "wire_length": 420,
        "layer_count": 6,
        "metal_width": 0.7,
        "spacing": 0.08,
    }

    low_violation, low_probability = predict(package, lower_risk)
    high_violation, high_probability = predict(package, higher_risk)

    assert 0 <= low_probability <= 1
    assert 0 <= high_probability <= 1
    assert high_probability > low_probability
    assert high_violation is True
    assert low_violation is False

    # Adjust one feature only and confirm that the model response changes.
    baseline = {
        "metal_area": 51,
        "gate_area": 8,
        "wire_length": 236,
        "layer_count": 3,
        "metal_width": 0.45,
        "spacing": 0.18,
    }
    changed = {**baseline, "metal_area": 10}
    _, baseline_probability = predict(package, baseline)
    _, changed_probability = predict(package, changed)
    assert abs(baseline_probability - changed_probability) > 0.05


def test_outdated_model_package_is_retrained(tmp_path):
    import pickle

    path = tmp_path / "old-model.pkl"
    with path.open("wb") as handle:
        pickle.dump(
            {"model": None, "accuracy": 0.99, "meta": {"version": "synthetic-v1"}},
            handle,
        )

    package = load_or_train(str(path))
    assert package["meta"]["version"] == MODEL_META["version"]
    assert package["model"] is not None


def test_each_input_parameter_can_change_risk(tmp_path):
    package = load_or_train(str(tmp_path / "model.pkl"))
    baseline = {
        "metal_area": 50,
        "gate_area": 10,
        "wire_length": 250,
        "layer_count": 3,
        "metal_width": 0.45,
        "spacing": 0.2,
    }
    variations = {
        "metal_area": (5, 100),
        "gate_area": (2, 23),
        "wire_length": (10, 580),
        "layer_count": (1, 8),
        "metal_width": (0.05, 1.1),
        "spacing": (0.05, 0.95),
    }
    for feature, (low, high) in variations.items():
        _, low_probability = predict(package, {**baseline, feature: low})
        _, high_probability = predict(package, {**baseline, feature: high})
        assert abs(high_probability - low_probability) > 0.03, feature


def test_model_package_has_complete_held_out_evaluation(tmp_path):
    package = load_or_train(str(tmp_path / "evaluated-model.pkl"))
    metrics = package["metrics"]
    assert package["meta"]["data_source"] == "synthetic"
    assert package["meta"]["is_foundry_validated"] is False
    for metric in ("accuracy", "precision", "recall", "f1_score", "roc_auc"):
        assert 0.0 <= metrics[metric] <= 1.0
    matrix = metrics["confusion_matrix"]["matrix"]
    assert len(matrix) == 2 and all(len(row) == 2 for row in matrix)
    assert sum(sum(row) for row in matrix) == metrics["test_samples"]
    assert set(package["feature_importance"]) == {
        "metal_area", "gate_area", "wire_length", "layer_count", "metal_width", "spacing"
    }


def test_prediction_diagnostics_flag_inputs_outside_training_domain(tmp_path):
    from app.ml.model import prediction_diagnostics

    package = load_or_train(str(tmp_path / "model-diagnostics.pkl"))
    values = {
        "metal_area": 500,
        "gate_area": 8,
        "wire_length": 236,
        "layer_count": 12,
        "metal_width": 0.45,
        "spacing": 0.18,
    }
    diagnostic = prediction_diagnostics(package, values)
    assert "metal_area" in diagnostic["out_of_training_range"]
    assert "layer_count" in diagnostic["out_of_training_range"]
    assert 0 <= diagnostic["tree_vote_agreement"] <= 1
    assert diagnostic["input_indicators"]
