from app.api.eda import parse_boolean_label, parse_upload


def test_normalized_csv_import_recognizes_common_eda_headers():
    raw = (
        "design,net,technology,rule_deck,metal_area_um2,gate_area_um2,wire_length_um,"
        "num_layers,metal_width_um,min_spacing_um,antenna_violation\n"
        "top,net_a,sky130A,deck-v1,35,8,180,4,0.45,0.18,true\n"
    ).encode()
    rows = parse_upload(raw, "eda.csv")
    assert len(rows) == 1
    row = rows[0]
    assert row["design_name"] == "top"
    assert row["net_name"] == "net_a"
    assert row["metal_area"] == "35"
    assert row["verified_violation"] == "true"


def test_label_parser_handles_verified_checker_results():
    assert parse_boolean_label("FAIL", 2) is True
    assert parse_boolean_label("PASS", 3) is False
    assert parse_boolean_label("", 4) is None
