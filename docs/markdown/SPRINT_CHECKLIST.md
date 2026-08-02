# Sprint Checklist

## Sprint 1 — Billing reliability and restore safety

### 1. Extract billing restore logic into a dedicated service
- [ ] Create a dedicated billing restore service module
- [ ] Move restore precedence logic out of the larger action layer
- [ ] Keep the existing behavior intact while simplifying the call site
- [ ] Add or update unit tests for restore precedence and fallback behavior

### 2. Add regression tests for delete/rework/correction flows
- [ ] Test restoring readings after bill deletion
- [ ] Test restoring readings after correction/rework operations
- [ ] Verify month and current reading values are restored correctly

### Effort
- Medium

### Outcome
Safer restore behavior and easier future maintenance.

---

## Sprint 2 — CSV import hardening

### 3. Improve import error reporting
- [ ] Capture row-level validation failures with clear messages
- [ ] Return structured partial-import diagnostics to the UI
- [ ] Ensure bad rows are skipped without aborting the whole import

### 4. Extract CSV import workflow into a focused service
- [ ] Separate parsing, validation, and persistence responsibilities
- [ ] Keep batch upload behavior while simplifying the UI flow
- [ ] Add tests for success and partial-failure import scenarios

### Effort
- Medium

### Outcome
More reliable imports and faster debugging when bad rows are present.

---

## Sprint 3 — Reporting and observability

### 5. Add structured logging for billing and import operations
- [ ] Log bill creation, delete, restore, and import outcomes
- [ ] Include bill ID, customer/meter ID, branch, and month in logs
- [ ] Add lightweight counters for imports and failures

### 6. Expand export coverage and validation
- [ ] Add tests for audit export content and formatting
- [ ] Verify CSV/XLSX exports include the expected bill-management columns
- [ ] Ensure export handles missing or empty values gracefully

### Effort
- Small to medium

### Outcome
Better operational visibility and more dependable reporting.

---

## Sprint 4 — Maintainability and access control cleanup

### 7. Simplify permission guards in middleware
- [ ] Introduce a shared helper for route permission checks
- [ ] Replace repeated inline conditions with a central pattern
- [ ] Preserve current access rules while reducing duplication

### 8. Reduce component and action file size where practical
- [ ] Identify large files that contain multiple responsibilities
- [ ] Break out helper functions or service modules gradually
- [ ] Keep changes scoped and low-risk

### Effort
- Medium

### Outcome
Lower maintenance cost and easier future feature work.

---

## Recommended order
1. Billing restore safety
2. CSV import hardening
3. Reporting and observability
4. Permission and middleware cleanup

## Definition of done
- Core billing and import flows are covered by automated tests
- Import failures are diagnosable and user-friendly
- Logging and export behavior are easier to verify and maintain
- The main modules are easier to evolve without introducing regressions
