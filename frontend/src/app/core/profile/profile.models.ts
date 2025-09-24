import { AuthenticatedUser } from '@core/models/auth';

export type UserProfile = AuthenticatedUser;

export interface ProfileFormState extends Record<string, unknown> {
  readonly nickname: string;
  readonly experienceYears: number | null;
  readonly roles: readonly string[];
  readonly bio: string;
  readonly location: string;
  readonly portfolioUrl: string;
}

export interface ProfileUpdatePayload extends ProfileFormState {
  readonly removeAvatar: boolean;
  readonly avatarFile: File | null;
}
