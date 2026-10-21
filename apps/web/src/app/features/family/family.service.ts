import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/configs/api.config';
import type { FamilyOverview } from './family.model';

@Injectable()
export class FamilyService {
  private readonly http = inject(HttpClient);
  readonly overview = httpResource<FamilyOverview>(() => ({ url: `${API_BASE_URL}/auth/family`, withCredentials: true }));

  createInvitation(email: string): Observable<{ token: string; expiresAt: string }> {
    return this.http.post<{ token: string; expiresAt: string }>(`${API_BASE_URL}/auth/family/invitations`, { email }, { withCredentials: true });
  }

  revokeInvitation(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${API_BASE_URL}/auth/family/invitations/${id}`, { withCredentials: true });
  }

}
