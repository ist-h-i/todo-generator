# Development Governance Handbook (Unified Edition)

## Purpose

This handbook consolidates repository-wide development, architecture, and AI-driven standards into a single authoritative reference.  
It ensures that human and AI contributors follow **consistent**, **safe**, and **maintainable** practices across backend (FastAPI), frontend (Angular), and automation pipelines.

---

## 1. Repository & Project Structure

- `backend/app`: FastAPI routers, services, models, migrations. Tests mirror structure under `backend/tests/**`.
- `frontend/src/app`: Angular modules; shared libs under `core`, `shared`, `lib`; features under `features/*`.
- Documentation: `docs/**` with `docs/README.md` as index.
- Automation: `scripts/**` for helpers (e.g., `run_codex_pipeline.sh`).
- Keep isolated environments (`.venv`, `node_modules`); no generated artefacts or local secrets in git.

---

## 2. Coding Principles (Global)

### 2.1 Core Philosophy

- Deliver **more than working code**—aim for quality, maintainability, and safety.
- Apply the **Boy Scout Rule**: leave every file cleaner than you found it.
- Prefer **clarity over cleverness**. Name by **intent**, not implementation.

### 2.2 Delete What You Don’t Use

- Remove unused variables, parameters, functions, imports, and feature flags immediately.
- **One-callsite helpers** → scope locally:
  - **TypeScript:** non-exported or nested in same file.
  - **Python:** inner function or `_module_private`.
- If intentionally retained (API, DI, reflection): comment with rationale and ticket reference.

#### CI Enforcement (Unused Code)

- **Python:** Ruff `F401,F841,B018` → fail build.  
- **TypeScript:** ESLint `no-unused-vars`, `no-unused-expressions`, plus `ts-prune`/`knip` in CI.

#### Git Hygiene (Commit Process)

- Write imperative, capitalized commit subjects around 65 characters.
- Squash fixups before merging.
- Sync with `develop` frequently (`git pull origin develop`) and resolve conflicts early.
- Rebase or merge `develop` before requesting review.
- PR descriptions must link the relevant issue, explain behavioural changes, and mention migrations or configuration updates.
- Include before/after screenshots for UI adjustments and record any manual QA completed.

---

### 2.3 Single Responsibility & Function Budgets

- One function = one reason to change.  
  - ≤ 40 lines, complexity ≤ 10, ≤ 5 parameters.
- Duplicate logic → extract or delete.

#### CI Enforcement (Function Complexity)

- **ESLint:** `"complexity": ["error",10]`, `"max-lines-per-function": ["warn",40]`  
- **Python:** Ruff `C901` or `flake8-cognitive-complexity`.

### 2.4 Refactoring in Passing

- Always refactor touched code for naming, types, and clarity.
- Keep incidental refactors small; large refactors → separate PR.

### 2.5 Visibility and Public Surface

- Reviewers must check for unused exports and visibility leaks.  
- Default to **least visibility**:
  - **TS/Angular:** `private`/`protected`; export via module facades only.  
  - **Python:** underscore for internals, limit `__all__`.

### 2.6 Facade-First Architecture

- Feature = **facade → service → adapter**.  
- No sideways or cross-feature deep calls.  
- Side-effects only at adapters; facades orchestrate, services compute.

#### Reviewer Questions

- Can the flow be understood via facade and service names only?
- Are there bypassing cross-feature calls?

### 2.7 Tests for All New or Changed Code

- All new paths → tests: happy + edge/error.
- Public APIs require unit tests; facades need thin integration tests.
- Test readability: Arrange-Act-Assert, minimal mocking.

#### CI Enforcement

- Block merges if changed code lacks test file changes.
- Track coverage deltas; disallow coverage regressions.

### 2.8 Public Surface Is Earned

- New exports/public methods need justification in PR.
- Promote local utils only after cross-module reuse and API stability.

### 2.9 Readability Over Cleverness

- Prefer explicit logic over dense tricks.
- Comments explain **why**, not what.

---

## 3. Python & Backend Practices

- Keep routers slim: validation + dependency injection only.
- Business logic → `app/services/**`.
- Data models via SQLAlchemy; schemas via Pydantic.
- Services isolate side effects (DB, APIs).
- Migrations are additive; destructive ops require explicit approval.
- Logging avoids secrets/PII; structured logging only.
- Enforce INFO-level logs in production.

---

## 4. Frontend & TypeScript Practices

### 4.1 Type Safety (No `any`)

- `any` forbidden except narrowly scoped, justified, and referenced (e.g., CVA `writeValue`).
- Validate unsafe inputs with type guards before use.
- Define DTOs in `frontend/src/app/shared/models/**`.

### 4.2 Style & Signals

- Angular v20+ uses **OnPush** & **Signals** by default.
- Presentational vs coordinator components separated.
- Styling uses tokens (`var(--*)`); accessible WCAG AA contrast.
- Use Conventional Commit prefixes (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
- Keep commits atomic and focused on a single change.
- Avoid committing directly to `develop` or `main`.

---

## 5. Tooling & CI Standards

### 5.1 Ruff (Python)

```toml
[tool.ruff]
line-length = 100
target-version = "py311"
lint.select = ["E","F","W","B","C90"]
[tool.ruff.lint.mccabe]
max-complexity = 10
```

### 5.2 ESLint (TypeScript)

```json
{
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-unused-expressions": "error",
    "complexity": ["error", 10],
    "max-lines-per-function": ["warn", { "max": 40, "skipComments": true }],
    "@typescript-eslint/explicit-module-boundary-types": "warn"
  }
}
```

### 5.3 Dead Export Check

```json
"scripts": {
  "lint:dead-exports": "ts-prune --ignoreTests",
  "ci:quality": "npm run lint && npm run lint:dead-exports && npm test -- --watch=false"
}
```

### 5.4 PR Guard (GitHub Actions)

```yaml
- name: Detect code changed without tests
  run: |
    CHANGED_CODE=$(git diff --name-only origin/main... | grep -E '^(backend|frontend)/.*\.(py|ts|tsx)$' || true)
    CHANGED_TESTS=$(git diff --name-only origin/main... | grep -E '(backend/tests/|\.spec\.ts$)' || true)
    if [ -n "$CHANGED_CODE" ] && [ -z "$CHANGED_TESTS" ]; then
      echo "::error::Code changed without companion tests."
      exit 1
    fi
```

---

## 6. Quality Gates & Automation

- Run only relevant checks:
  - `pytest backend/tests`
  - `ruff check backend`
  - `black --check backend/app backend/tests`
  - `npm run lint`, `npm run test -- --watch=false`, `npm run build`
- Documentation-only updates skip CI but require proofreading.
- UI changes: attach before/after screenshots.

---

## 7. Security & Configuration

- Secrets only via environment variables.
- Validate all external input.
- Operate on least privilege.
- Audit dependencies regularly.
- Secure CORS origins and prevent PII leakage.

---

## 8. AI-Driven Development Common Standards

### 8.1 Code Quality & Maintainability

- Follow DRY; fix small issues immediately.
- Remove unused code proactively.
- Update dependencies regularly.
- Comment deviations with rationale.
- Fix causes, not symptoms.
- Cover error paths with tests.
- Return actionable messages.

### 8.2 Error Handling and Privacy

- Model only fields needed by the UI; prefer narrow `Pick<>`s per feature.
- Do not put PII in logs, URLs, or client storage.
- Keep sensitive values in memory only.
- Gate telemetry/analytics behind consent and scrub values client-side.

### 8.3 Testing Discipline

- No skipped tests.
- Independent, deterministic, observable tests.

### 8.4 Security Mindset

- Encrypt secrets; validate all inputs.
- Regular dependency audits.

### 8.5 Performance & Reliability

- Optimize via measurement.
- Guard against N+1.
- Add caching and circuit breakers.

### 8.6 Continuous Improvement

- Capture lessons, run retrospectives, refine process.

---

## 9. Git & Workflow Agreements

1. Sync with `main` regularly; resolve conflicts early.  
2. Implement small, reviewed commits.  
3. Run relevant checks.  
4. Keep documentation current.  
5. Capture UI evidence for visual changes.  
6. Rebase or merge latest `main` before PR.

### Commit Rules

- Conventional commits (`feat:`, `fix:`, etc.)
- English, atomic, descriptive.

---

## 10. Code Review Checklist

- [ ] No unused imports/vars/exports.  
- [ ] Minimum visibility; no unnecessary `public/export`.  
- [ ] Small, single-purpose functions.  
- [ ] Clear facade boundaries.  
- [ ] New/changed code includes tests (happy + edge).  
- [ ] Code readable; comments explain “why”.  
- [ ] No code-only changes without test updates.  
- [ ] Follows architectural layering.

---

## 11. Example Implementations

### TypeScript (Facade & Local Helper)

```ts
export class BillingFacade {
  constructor(private readonly svc: BillingService) {}
  async charge(orderId: string) { return this.svc.chargeOrder(orderId); }
}

class BillingService {
  async chargeOrder(orderId: string) {
    const parse = (s: string) => Number.parseInt(s, 10);
    const cents = parse(await fetchCents(orderId));
    return gateway.charge(cents);
  }
}
```

### Python (Private Helper)

```py
def _normalize_amount(raw: str) -> int:
    return int(raw)

def charge(order_id: str) -> Receipt:
    def _parse(raw: str) -> int:
        return int(raw)
    cents = _parse(fetch_amount(order_id))
    return gateway.charge(cents)
```

---

## 12. Workflow Automation & AI Constraints

- Codex runs skip external contributor secrets.
- Authentication via ChatGPT (not API key).  
- For Agent Mode: branch from latest `main`, commit per stage, push frequently.  
- Conflicts must be resolved; no markers in tree.  
- Review all auto-generated diffs for correctness.

---

## 13. Documentation Standards

- Keep README and docs synchronized with code.
- Provide examples and ADRs for major decisions.
- Avoid drift; update diagrams and cross-refs on behavioural change.

---

## 14. Summary: Guiding Principles

| Principle | Core Idea |
|------------|------------|
| **Clarity** | Code should be self-explaining and minimal. |
| **Responsibility** | Each module and function serves one purpose. |
| **Safety** | All errors handled; secrets protected. |
| **Testing** | Every change verified by automated tests. |
| **Architecture** | Facade → service → adapter; no spaghetti dependencies. |
| **Refinement** | Continuous cleanup and documentation alignment. |
