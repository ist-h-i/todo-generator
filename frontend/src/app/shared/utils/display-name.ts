export type UserLike = {
  readonly nickname?: string | null;
  readonly email?: string | null;
};

/**
 * Returns a user's display name, preferring nickname when present.
 * - Trims whitespace.
 * - Falls back to email when nickname is empty.
 */
export function getDisplayName(user: UserLike): string {
  const nickname = (user.nickname ?? '').trim();
  if (nickname.length > 0) {
    return nickname;
  }

  return (user.email ?? '').trim();
}
