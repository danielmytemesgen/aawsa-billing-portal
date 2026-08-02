# Implementation Action Plan

This plan turns the audit findings into a practical roadmap with the highest-impact tasks first.

## Priority 1 — Consolidate billing restore and import logic

### Goal
Reduce the risk of billing inconsistencies by moving restore and batch-import behavior into focused service modules instead of keeping them dispersed in large server-action files.

### Tasks
- Extract billing restore handling into a dedicated service module with a clear contract for precedence and fallback values.
- Move CSV import orchestration into a focused import service that handles validation, persistence, and row-level error reporting separately.
- Replace scattered inline logic with shared helpers that can be tested directly.

### Expected impact
High. This improves correctness and makes future billing changes safer.

### Acceptance criteria
- Restore logic is covered by regression tests for delete, rework, and correction flows.
- Import logic can be tested independently of the UI layer.
- The main server action files become smaller and easier to understand.

---

## Priority 2 — Add integration tests for the most business-critical workflows

### Goal
Protect the billing and CSV flows from regressions by adding tests that reflect real user behavior.

### Tasks
- Add integration tests for bill delete/restore behavior.
- Add tests for bulk and individual CSV import success and partial-failure paths.
- Add export tests to confirm audit reports contain the expected columns and values.

### Expected impact
High. Prevents regressions in the workflows that matter most to operations.

### Acceptance criteria
- At least one end-to-end regression test exists for each major billing flow.
- Import failures produce consistent, predictable results.
- Tests run automatically in CI or local validation scripts.

---

## Priority 3 — Improve CSV diagnostics and user feedback

### Goal
Make import failures easier to understand for both administrators and support staff.

### Tasks
- Add row-level error summaries that clearly identify the failing row, field, and reason.
- Return structured server-side diagnostics for partial imports.
- Surface a downloadable error log for invalid rows.

### Expected impact
Medium-high. This reduces operational support effort and improves trust in the import process.

### Acceptance criteria
- Users can quickly see which rows failed and why.
- Failed rows are skipped without crashing or silently dropping all data.
- Error details are preserved in a downloadable report.

---

## Priority 4 — Introduce structured logging and monitoring for billing jobs

### Goal
Make production incidents easier to diagnose without relying on ad-hoc log inspection.

### Tasks
- Add structured logs for billing creation, restore, import, and job processing.
- Record key identifiers such as bill ID, meter/customer IDs, branch, and month.
- Add lightweight metrics for import counts, failure counts, and processing duration.

### Expected impact
Medium. Improves maintainability and troubleshooting.

### Acceptance criteria
- Logs are consistent across billing and import modules.
- Failed operations can be traced quickly from log output.
- Production issues are easier to investigate without code changes.

---

## Priority 5 — Simplify permission and route guards

### Goal
Reduce the size and complexity of the middleware layer while keeping access control strict.

### Tasks
- Replace repeated route-specific checks with a shared permission-guard helper.
- Group routes by feature and apply rules from a central configuration map.
- Keep the current security model but make it easier to extend.

### Expected impact
Medium. Improves maintainability and reduces accidental permission gaps.

### Acceptance criteria
- Middleware becomes easier to read and maintain.
- New sensitive routes can be protected using the same shared pattern.
- Existing access rules remain unchanged.

---

## Suggested rollout order

1. Billing restore and import service extraction
2. Integration tests for billing and CSV workflows
3. CSV diagnostics and error-report improvements
4. Structured logging and monitoring
5. Middleware and permission guard refactor

## Expected outcome
By completing these tasks in order, the platform will become more reliable, easier to maintain, and safer for future feature work.
