#!/usr/bin/env python3
"""Join exported per-net physical features to a normalized antenna-check report.

Features CSV must contain design_name, net_name and AntennaGuard's six numeric
features. The violations CSV must contain design_name and net_name. If the
violations CSV also contains verified_violation / violation, those explicit
labels are used. If it only lists failing nets, the other feature rows remain
unlabelled unless --complete-report is supplied to assert that the report is a
complete all-net result for the same design and rule deck.
"""
import argparse
import csv
import re
from pathlib import Path

FEATURES = ["metal_area", "gate_area", "wire_length", "layer_count", "metal_width", "spacing"]


def key(name):
    return re.sub(r"[^a-z0-9]", "", name.strip().lower())


def read_csv(path):
    with open(path, newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError(f"{path} has no header row")
        rows = list(reader)
    return reader.fieldnames, rows


def get(row, *names):
    mapped = {key(k): v for k, v in row.items() if k is not None}
    for name in names:
        if key(name) in mapped:
            return mapped[key(name)]
    return ""


def parse_label(value):
    value = str(value or "").strip().lower()
    if value in {"true", "1", "yes", "y", "fail", "failed", "violation", "violated"}:
        return "true"
    if value in {"false", "0", "no", "n", "pass", "passed", "clean", "no_violation"}:
        return "false"
    if value == "":
        return ""
    raise ValueError(f"Unsupported label: {value!r}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--features", required=True, help="CSV exported from routed design features")
    parser.add_argument("--violations", required=True, help="CSV normalized from a completed antenna-check report")
    parser.add_argument("--out", required=True, help="Output CSV to import into AntennaGuard")
    parser.add_argument("--source-tool", default="OpenROAD / normalized EDA report")
    parser.add_argument("--technology", default="", help="PDK or technology name, if known")
    parser.add_argument("--rule-deck", default="", help="Exact rule deck/profile, if known")
    parser.add_argument("--complete-report", action="store_true", help="Assert that the violation file is a complete report covering every net from the same design/check run; absence then means no violation")
    args = parser.parse_args()

    _, feature_rows = read_csv(args.features)
    violation_headers, violation_rows = read_csv(args.violations)
    if not feature_rows:
        raise SystemExit("Feature CSV has no records")
    first = feature_rows[0]
    missing = [name for name in ["design_name", "net_name", *FEATURES] if get(first, name) == ""]
    if missing:
        raise SystemExit("Feature CSV is missing required fields: " + ", ".join(missing))

    labels = {}
    label_header_names = {key(name) for name in ["verified_violation", "antenna_violation", "violation", "is_violating"]}
    # A header is authoritative even if some row values are blank; blank labels
    # stay unlabelled rather than silently treating every row as a violation.
    explicit_label_seen = any(key(header) in label_header_names for header in violation_headers)
    for row in violation_rows:
        design = get(row, "design_name", "design", "block")
        net = get(row, "net_name", "net")
        if not design or not net:
            raise SystemExit("Every violation row must include design_name and net_name")
        label_text = get(row, "verified_violation", "antenna_violation", "violation", "is_violating")
        label = parse_label(label_text) if explicit_label_seen else "true"
        labels[(design.strip(), net.strip())] = label

    output_rows = []
    unmatched = 0
    for row in feature_rows:
        design = get(row, "design_name", "design", "block")
        net = get(row, "net_name", "net")
        identity = (design.strip(), net.strip())
        if identity in labels:
            label = labels[identity]
        elif explicit_label_seen:
            label = ""
        elif args.complete_report:
            label = "false"
        else:
            label = ""
            unmatched += 1
        output_rows.append({
            "design_name": design,
            "net_name": net,
            "technology": get(row, "technology", "pdk") or args.technology,
            "rule_deck": get(row, "rule_deck", "pdk_rule_deck") or args.rule_deck,
            "source_tool": args.source_tool,
            **{name: get(row, name) for name in FEATURES},
            "verified_violation": label,
        })

    columns = ["design_name", "net_name", "technology", "rule_deck", "source_tool", *FEATURES, "verified_violation"]
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(output_rows)
    labelled = sum(row["verified_violation"] in {"true", "false"} for row in output_rows)
    print(f"Wrote {len(output_rows)} rows to {out}")
    print(f"Labelled rows: {labelled}; unlabelled rows: {len(output_rows) - labelled}")
    if unmatched and not args.complete_report and not explicit_label_seen:
        print(f"Note: {unmatched} non-listed nets remain unlabelled. Pass --complete-report only if the report is known complete for the same design and rule deck.")


if __name__ == "__main__":
    main()
