export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface TokenResponse {
  readonly access_token: string;
  readonly token_type: 'bearer';
  readonly user: AuthenticatedUser;
}
