# Recipe: ProfileService

Source: `frontend/src/app/core/profile/profile.service.ts`

## Purpose & Responsibilities
Provide API operations to fetch and update the current user profile via HTTP.

## Public API
- Methods:
  - `fetch()` – GET the current user profile from `/profile/me`.
  - `update(payload)` – PUT changes to `/profile/me` using multipart form data.
- Properties: (none detected)

## Notable Dependencies
- Injects Angular `HttpClient`.
- Uses `buildApiUrl()` to resolve backend endpoints.

## Usage Notes
- `update` builds a `FormData` payload; omit empty values to avoid unintended clears.
- Callers should handle the returned `Observable<UserProfile>` and subscribe in components.

## Change History
- Seeded by generator. Append context on future changes.

