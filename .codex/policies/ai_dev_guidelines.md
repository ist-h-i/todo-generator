# AI Agent Development Guidelines (Optimized Version)

## 1. Core Principle

* The goal is to generate accurate and maintainable outputs with minimal cost.
* Execution scope must be strictly limited to required tasks.
* Each phase (design, implementation, testing, documentation) is autonomously filtered to avoid unnecessary execution.
* Improvement opportunities must be logged and proposed without redundant loops or repeated runs.

## 1.1 Mandatory References

* Always read and fully comply with the [Development Governance Handbook](..\..\docs\governance\development-governance-handbook.md) and the [Angular Coding & Design Guidelines](..\..\docs\guidelines\angular-coding-guidelines.md) before defining strategies, prompts, or automation routines.
* Reference the documentation index at [docs/README.md](..\..\docs\README.md) to confirm any additional domain, architecture, or workflow guidance that applies to the task.

---

## 2. Task Scope Rules

| Task Type                            | Allowed Actions                                            | Excluded Actions                     |
| ------------------------------------ | ---------------------------------------------------------- | ------------------------------------ |
| Code Implementation / Fix            | Syntax check, dependency validation, relevant tests, build | Unrelated module tests, full rebuild |
| Documentation / README / Design Docs | Markdown formatting, link validation, metadata updates     | All unit tests, linting, builds      |
| UI / Style Adjustments               | HTML/CSS/TS integrity check                                | Backend build, pytest                |
| CI / Config Update                   | Workflow syntax validation only                            | Full test execution                  |
| Translation / Annotation Update      | Diff detection, formatting                                 | Dependency check, test execution     |

---

## 3. Execution Control

* Execution is limited to detected diffs.
* In Codex pipelines, tasks run only if `RUN_CODEX == true`.
* When only `docs/` or `.md` files are modified, skip all builds and tests.
* Skipped actions must log "skip: no runtime impact detected".
* Unless dependencies or runtime impacts are explicitly found, skip full tests, database access, and API calls.

---

## 4. Validation and Quality Assurance

* Syntax and dependency checks apply only to code-generation tasks.
* Documentation updates use static validation (format and links).
* Quality metrics: consistency, explainability, and stability.
* No unnecessary unit tests, API calls, or dependency updates.

---

## 5. Autonomous Decision Logic

```bash
if task_type == "doc" or modified_files in ["docs/", ".md"]:
    skip("build", "unit-test", "integration-test")
elif task_type == "code":
    run("lint", "unit-test", "build")
elif task_type == "config":
    run("lint", "syntax-check")
else:
    minimal("self-validation")
```

---

## 6. Output Constraints

* Do not modify files outside the defined scope.
* Output only essential files and related metadata.
* Large changes must be committed in diff-based atomic units.
* Avoid redundant file creation or deletion.

---

## 7. Feedback and Continuous Optimization

* If unnecessary tasks are executed, record and exclude them in future runs.
* Log skipped-task history in `codex_output/status.json`.
* Periodically evaluate waste ratio and refine task minimization.

---
