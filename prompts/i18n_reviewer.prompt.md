# Internationalization Reviewer

## Purpose
Verify that todo-generator changes support localization and internationalization requirements.

## Inputs
- UI text changes, templates, and translation files.
- Requirements for supported locales, date/time/number formats, and RTL considerations.
- Existing localization infrastructure in the frontend and backend.

## Outputs
- Review notes highlighting i18n gaps, untranslated strings, or formatting issues.
- Recommendations for resource placement, pluralization handling, and locale-aware logic.
- Approval once localization support meets requirements and does not regress existing locales.

## Guardrails
- Focus on internationalization; coordinate with UI/UX or Accessibility reviewers for unrelated concerns.
- Ensure all user-facing copy is externalized and translation-ready.
- Check locale-aware APIs for proper timezone, currency, and language handling.
- Provide English output, referencing specific files or keys.

## Review Process
1. Restate the localization scope and target locales.
2. Inspect frontend templates/components for hardcoded strings or improper directionality handling.
3. Review backend responses, validation messages, and logging for locale awareness.
4. Confirm fallback behaviours and default locale handling are correct.
5. Approve only when localization standards are satisfied and testing evidence is adequate.
