# AntennaGuard EDA import and verification guide

## Scope and data integrity

AntennaGuard accepts **normalized per-net CSV or JSON** for import. Each row must combine physical features extracted from the design with optional actual antenna-check labels. It does not parse GDSII/OASIS or arbitrary tool log formats, execute a foundry rule deck, or automatically fix layout geometry. An imported label should only be called verified if it came from a completed checker run on the matching design, technology, and rule deck.

The bundled Random Forest is still trained on synthetic teaching data. Imported EDA records are saved separately and **do not silently retrain or replace the live model**. This prevents a few records, mismatched technology nodes, or uncertain labels from contaminating production predictions.

## Normalized CSV schema

Required numeric fields (header aliases are accepted for common variants):

- `metal_area`
- `gate_area`
- `wire_length`
- `layer_count` (integer)
- `metal_width`
- `spacing`

Recommended metadata:

- `design_name`, `net_name`
- `technology`, `rule_deck`
- `source_tool`
- `verified_violation`: `true`/`false`, `1`/`0`, or `FAIL`/`PASS`; leave blank when no valid ground-truth label is available.

The API limits each import to 5 MB and 5,000 rows. It validates every row before committing the import, so one invalid row rejects the whole batch. The source file SHA-256 is retained with every row for traceability.

JSON may be a list of objects or `{"records": [{...}, ...]}`.

## Preparing an OpenROAD-oriented dataset

The actual antenna checker uses routed connectivity, layer geometry, and the selected technology rules. Feature exports and checker reports should be prepared from the **same design revision and rule-deck run** and joined by `(design_name, net_name)`.

1. Export one row per net with the six feature fields and `design_name`, `net_name`. Use consistent units and document the feature definitions. If a metric cannot be extracted, do not invent it; the importer currently requires all six model inputs.
2. Normalize the antenna-check result into a CSV with `design_name`, `net_name`, and preferably an explicit `verified_violation` label.
3. Join the two CSVs:

   ```powershell
   python scripts/join_eda_features_and_violations.py --features features.csv --violations antenna_results.csv --out normalized_eda.csv --technology sky130A --rule-deck your-rule-deck-version
   ```

   If the result file lists **only failing nets**, non-listed nets will be left unlabelled by default. Use `--complete-report` only when you have confirmed the checker result is complete for every net in the same design and run; then non-listed nets are labelled as no violation. This safeguard prevents false negative labels from incomplete reports.
4. In the AntennaGuard **EDA Verification** page, import `normalized_eda.csv`, select the source tool, and inspect the import counts. Review the EDA Records list to confirm labels and metadata.

OpenROAD commands/report layouts can vary with version and flow. This helper expects a normalized CSV and does not scrape arbitrary terminal output. Add a tool-specific adapter after confirming the exact output format for your installed version.

## Recording a real correction check

1. Run a saved AntennaGuard prediction on the parameter set that you are studying.
2. Make the proposed correction in the actual EDA tool (routing changes, a legal jumper/layer transition, protection-cell insertion, or another PDK-approved fix).
3. Run the actual antenna checker using the intended rule deck.
4. On **EDA Verification**, select the saved prediction, enter design, net, technology, rule deck, tool, the confirmed `PASS`, `FAIL`, or `INCONCLUSIVE` result, violation count, and correction tried. Expand the feature-snapshot section and enter the six features from the exact layout that was checked. Do not label a post-correction result using pre-correction features. Add a report reference and optional report SHA-256 for traceability.
5. Only conclusive results with an explicit six-feature snapshot from the exact layout checked are added as labelled rows to the verified dataset. Merely linking a pre-correction prediction does not reuse its inputs as post-correction labels. Use **Download verified dataset** to export these rows for future evaluation. Keep different technologies/rule decks separated when analyzing generalization.

A saved form is a user-entered verification record. AntennaGuard does not independently authenticate that the checker was run; retain source reports and review provenance before using records for academic or engineering claims.

## Model evaluation semantics

The model evaluation page reports accuracy, precision, recall, F1, ROC-AUC, confusion matrix, test size and feature importance for the reproducible held-out **synthetic** split. These are software-validation metrics, not real EDA or foundry results. Random Forest probabilities and per-tree vote agreement are uncalibrated model signals. Use a separate design-level held-out dataset of completed EDA checks before reporting real-world performance.
