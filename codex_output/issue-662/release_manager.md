**Release Readiness**

- Verdict: Ready to ship. No code changes required; the selector already closes the options panel on option click and restores focus to the trigger.

**Scope Confirmation**

- Target: Custom single-select `app-ui-select`.
- Unaffected: Multi/size variants using native `<select>` remain unchanged.

**Evidence (Key Lines)**

- Option click binding closes via handler: frontend/src/app/shared/ui/select/ui-select.ts:98
- Click handler selects then closes: frontend/src/app/shared/ui/select/ui-select.ts:348, frontend/src/app/shared/ui/select/ui-select.ts:355
- Close routine with optional focus restore: frontend/src/app/shared/ui/select/ui-select.ts:330
- Outside click closes (no forced focus): frontend/src/app/shared/ui/select/ui-select.ts:522, frontend/src/app/shared/ui/select/ui-select.ts:528
- Enter selects active option and closes: frontend/src/app/shared/ui/select/ui-select.ts:547, frontend/src/app/shared/ui/select/ui-select.ts:551
- Escape closes with focus restore: frontend/src/app/shared/ui/select/ui-select.ts:554, frontend/src/app/shared/ui/select/ui-select.ts:555

**Verification Steps**

- Open selector → click an option → panel closes, value updates, focus returns to trigger.
- Arrow keys to option + Enter → selection and close.
- Escape → closes; click outside → closes without focus jump.
- Multi/size/native `<select>` paths behave as before.

**Compatibility/Impact**

- No API or dependency changes.
- Behavior already matches the requirement; multi-select/native unchanged.

**Residual Risks / Open Questions**

- Keyboard parity: Should Space also select/close for single-select, like Enter?
- Event ordering: If any browser reports blur/click timing issues, switch option handler to mousedown (not needed now).
- Overlay/portal refactors: Re-validate outside-click containment if panel is moved.
- Content safety: If option labels become rich HTML, maintain sanitization (current interpolation is safe).
- Server effects: If selection triggers server-side changes, ensure allowlisting/validation and CSRF protections.

**Approvals**

- Product/UX: Confirm Space key expectation (retain Enter-only vs. add Space).
- A11y: Confirm focus return to trigger on intentional close.

**Rollback Plan**

- Not applicable (no code changes). If issues arise, revert the issue status.