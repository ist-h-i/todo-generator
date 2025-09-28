# Gemini Migration Specification Update

As of this revision, the product specification replaces the OpenAI ChatGPT analysis
integration with Google Gemini. The following requirements capture the new AI
integration expectations until the implementation is completed.

## Service Alignment
- The backend analysis, status report, and appeal flows must invoke a Gemini
  client instead of the existing ChatGPT client when generating proposals or
  narratives.
- Gemini requests must continue to enforce structured JSON responses, schema
  validation, and failure handling consistent with the current Gemini-based
  behavior.
- Error handling expectations remain unchanged: upstream Gemini errors should
  translate to HTTP 502 responses, while configuration issues should surface as
  HTTP 503 responses during dependency setup.

## Configuration
- Store the Gemini API key through the admin settings UI, replacing the previous
  ChatGPT key.
- Introduce a `GEMINI_MODEL` environment variable to identify the target Gemini
  model. Until code changes land, maintain compatibility with the existing
  `CHATGPT_MODEL` setting but favor the new variable in documentation and
  configuration tooling.
- Update operational runbooks and deployment manifests to provision Gemini
  credentials and endpoint configuration.

## Action Items
- Replace references to `ChatGPTClient` with a Gemini-aware client in backend
  services once implementation work begins.
- Refresh automated and manual test plans to cover Gemini-specific behaviors and
  rate limits.
- Remove residual ChatGPT terminology from feature documentation after the code
  migration is complete.

This document should accompany any future merge requests that introduce the
Gemini client to ensure reviewers validate the implementation against the updated
specification.
