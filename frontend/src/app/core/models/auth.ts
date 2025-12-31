export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly is_admin: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly nickname: string | null;
  readonly experience_years: number | null;
  readonly roles: readonly string[];
  readonly bio: string | null;
  readonly avatar_url: string | null;
}

export interface TokenResponse {
  readonly access_token: string;
  readonly token_type: 'bearer';
  readonly user: AuthenticatedUser;
}

export interface RegistrationResponse {
  readonly message: string;
  readonly requires_approval: boolean;
  readonly admin_email: string | null;
}

export interface AdminContactResponse {
  readonly email: string | null;
}
