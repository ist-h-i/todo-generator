**Scope**
- SBOM and license audit for current repo; no code changes.
- Focus on manifests, license files, and obvious license risks.

**Project License State**
- No root license file found: add `LICENSE` to clarify project licensing.
- Frontend `frontend/package.json:1` has `"private": true` but no `"license"` field; still add a license file at repo root for clarity across backend and frontend.

**Manifests Located**
- Backend Python
  - `backend/requirements.txt:1`
  - `backend/requirements-dev.txt:1`
  - `requirements.txt:1` (root, overlaps with backend)
  - No Python project metadata (`pyproject` with `[project]`) and no lock with hashes; SBOM will be best-effort from requirements pins.
- Frontend Node/Angular
  - `frontend/package.json:1`
  - `frontend/package-lock.json:1`
  - `frontend/angular.json:1`

**Runtime Dependencies (Summary)**
- Backend (from pinned/pegged requirements)
  - `fastapi`, `uvicorn[standard]`, `SQLAlchemy`, `pydantic`, `pydantic-settings`, `email-validator`, `alembic`, `python-multipart`, `httpx`, `google-generativeai`, `Pillow`, `Jinja2`, `cryptography`
- Frontend (production)
  - `@angular/* 20.x`, `rxjs 7.8.x`, `tslib 2.8.x`, `zone.js 0.15.x`
- Frontend (dev)
  - Angular build/CLI, `eslint` + plugins, `prettier`, `karma`/`jasmine`, `puppeteer`, `tailwindcss`, `esbuild`, `postcss`, `autoprefixer`, `typescript`, `patch-package`

**Observed Licenses**
- NPM: `frontend/package-lock.json:7` includes per‑package `"license"` fields (sample entries MIT observed). No matches for GPL/AGPL/LGPL/SSPL in the lock:
  - Searched `frontend/package-lock.json` for copyleft strings: none found.
- Python: Requirements do not include license metadata. License resolution requires package index or local metadata inspection not available in this environment.

**Patches/Vendored Changes**
- `frontend/patches/karma+6.4.4.patch:1` modifies Karma internals via `patch-package`. Karma is a dev dependency; ensure its upstream license notice remains intact in any redistributed form. Low risk if not shipping Karma code.

**Potential Compliance Risks**
- Missing project license file → ambiguous licensing for consumers (must fix before release).
- Python license coverage unknown offline → requires verification (FastAPI/SQLAlchemy/Pydantic/etc. are typically permissive, but do not assume).
- No Python lock with hashes → reproducibility and SBOM determinism reduced; consider locking strategy for accurate SBOM (e.g., `pip-tools`/`uv`/`poetry`).

**Prohibitions/Red Flags**
- Copyleft strong licenses (GPL/AGPL/LGPL/SSPL): none detected in NPM lock via string search.
- Non-OSS or usage-restricted libs: cannot confirm for Python without network; verify `google-generativeai` terms in release context.

**SBOM Generation Recommendations**
- NPM: Generate CycloneDX JSON from lock for full license inventory:
  - `cd frontend && npx @cyclonedx/cyclonedx-npm --output-file bom.json`
- Python: Generate CycloneDX from installed environment or requirements:
  - Use `cyclonedx-bom` or `pip-licenses` + `cyclonedx-python-lib` in CI for accurate license capture.
- Consolidate artifacts and publish with release assets; keep a THIRD_PARTY_NOTICES file if required by licenses detected.

**Actions to Resolve**
- Add a repository `LICENSE` file reflecting intended project license.
- Run automated license scanning in CI:
  - NPM: CycloneDX + `license-checker`/`npm-package-licenses`.
  - Python: `pip-licenses --format=json` (or CycloneDX Python).
- Review Python dependencies’ licenses (especially `cryptography`, `Pillow`, `google-generativeai`) and document any attribution or notice requirements.
- Maintain SBOMs per release; fail CI on prohibited licenses according to your policy.

**Current Conclusion**
- No obvious copyleft issues in frontend dependencies.
- Project license missing; Python license coverage unverified. Add license file and run license scanners to complete SBOM and compliance gates.