# Implementation Plan to Solve the Audit Findings

## Objective
Address the main reliability, maintainability, and operability issues identified in the audit without a full rewrite.

## Phase 1 — Stabilize the billing and restore flow

### 1.1 Extract restore logic into a dedicated billing service
- Create a dedicated service module for billing restore and correction handling.
- Move restore precedence logic out of the large action layer into this service.
- Keep the current restore behavior intact while making it easier to test and evolve.

### 1.2 Add regression coverage for the critical restore scenarios
- Add tests for bill deletion restore behavior.
- Add tests for rework/correction restore behavior.
- Verify that both bulk meter and individual customer readings restore correctly.

### 1.3 Reduce coupling in the billing action layer
- Split large server-action responsibilities into smaller helpers.
- Keep DB access, business rules, and orchestration separated.

### Deliverable
A more reliable and testable billing restore workflow.

---

## Phase 2 — Harden CSV import and data-entry operations

### 2.1 Improve row-level error handling
- Ensure invalid rows are clearly identified with row numbers and field-level reasons.
- Preserve the import of valid rows even when some rows fail.
- Return structured error summaries to the UI.

### 2.2 Separate import concerns into smaller modules
- Create a dedicated import service for parsing, validating, and persisting CSV rows.
- Keep the UI component focused on file selection and feedback.
- Avoid mixing transport, validation, and persistence concerns in one place.

### 2.3 Add integration tests for import behavior
- Test successful imports.
- Test partial failures with a mix of valid and invalid rows.
- Test that error reporting is consistent and user-friendly.

### Deliverable
A CSV import process that is more robust, diagnosable, and easier to maintain.

---

## Phase 3 — Improve observability and operational support

### 3.1 Add structured logging for critical operations
- Log billing creation, delete, restore, and import outcomes.
- Include the associated bill ID, meter/customer ID, branch, and month.
- Log failures with enough context to diagnose the issue quickly.

### 3.2 Add lightweight performance and status metrics
- Track import duration and row counts.
- Track restore and billing operation durations.
- Capture failure rates for important workflows.

### 3.3 Make logs easier to search and analyze
- Use a consistent prefix or format for operational logs.
- Keep logging useful in both development and production environments.

### Deliverable
A system that is easier to troubleshoot during production incidents.

---

## Phase 4 — Simplify permission and route management

### 4.1 Refactor middleware into shared permission helpers
- Replace repetitive inline permission checks with a shared guard helper.
- Group route checks by feature or access domain.
- Preserve the current security rules while reducing duplication.

### 4.2 Add focused authorization tests
- Test protected route access for admin and staff users.
- Test that unauthorized users are redirected correctly.
- Ensure branch-based and module-based permission rules still work.

### Deliverable
A smaller, easier-to-maintain permission layer with the same or better security behavior.

---

## Phase 5 — Improve code structure and maintainability

### 5.1 Split oversized modules gradually
- Identify the largest server and UI modules that currently mix too many concerns.
- Move business logic into focused service modules and keep components thin.
- Apply this refactor incrementally so the risk stays low.

### 5.2 Standardize common utilities
- Consolidate repeated formatting, export, and validation helpers.
- Reduce duplicated logic across billing, reporting, and CSV modules.

### 5.3 Increase module-level documentation
- Add short documentation for the critical services and flows.
- Make the architecture easier for the next developer to understand.

### Deliverable
A codebase that is easier to extend and less fragile when new features are added.

---

## Execution Order
1. Billing restore stabilization
2. CSV import hardening
3. Logging and observability
4. Permission middleware cleanup
5. Structural refactoring and documentation

## Success Criteria
- Billing restore behavior is covered by regression tests.
- CSV import handles valid and invalid rows predictably.
- Failed operations produce useful diagnostics.
- Middleware and route access logic are easier to maintain.
- The app remains stable while these changes are introduced.
