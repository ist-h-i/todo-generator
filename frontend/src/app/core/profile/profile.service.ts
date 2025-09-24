import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { buildApiUrl } from '@core/api/api.config';

import { ProfileUpdatePayload, UserProfile } from './profile.models';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);

  public fetch(): Observable<UserProfile> {
    return this.http.get<UserProfile>(buildApiUrl('/profile/me'));
  }

  public update(payload: ProfileUpdatePayload): Observable<UserProfile> {
    const formData = new FormData();

    formData.append('nickname', payload.nickname.trim());

    if (payload.experienceYears !== null) {
      formData.append('experience_years', String(payload.experienceYears));
    }

    if (payload.roles.length > 0) {
      formData.append('roles', JSON.stringify(payload.roles));
    }

    const bio = payload.bio.trim();
    if (bio) {
      formData.append('bio', bio);
    }

    const location = payload.location.trim();
    if (location) {
      formData.append('location', location);
    }

    const portfolioUrl = payload.portfolioUrl.trim();
    if (portfolioUrl) {
      formData.append('portfolio_url', portfolioUrl);
    }

    if (payload.removeAvatar) {
      formData.append('remove_avatar', 'true');
    }

    if (payload.avatarFile) {
      formData.append('avatar', payload.avatarFile, payload.avatarFile.name);
    }

    return this.http.put<UserProfile>(buildApiUrl('/profile/me'), formData);
  }
}
