import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/configs/api.config';
import { isNativeApp } from '../../core/configs/native-platform.config';
import type { AuthUser } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';
import type { InvitationPreview, InviteRegistration } from './family.model';

@Injectable()
export class InvitationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  preview(token: string): Observable<InvitationPreview> {
    return this.http.get<InvitationPreview>(`${API_BASE_URL}/auth/invitations/${token}`);
  }

  accept(token: string): Observable<{ user: AuthUser }> {
    if (isNativeApp()) {
      return this.http.post<{ user: AuthUser }>(
        `${API_BASE_URL}/auth/mobile/invitations/${encodeURIComponent(token)}/accept`,
        {},
      );
    }
    return this.http.post<{ user: AuthUser }>(`${API_BASE_URL}/auth/invitations/${token}/accept`, {}, { withCredentials: true });
  }

  register(token: string, payload: InviteRegistration): Observable<{ user: AuthUser }> {
    if (isNativeApp()) return this.auth.registerMobileInvitation(token, payload);
    return this.http.post<{ user: AuthUser }>(`${API_BASE_URL}/auth/invitations/${token}/register`, payload, { withCredentials: true });
  }
}
