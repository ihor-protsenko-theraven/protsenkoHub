import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, string>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value) {
          httpParams = httpParams.set(key, value);
        }
      }
    }
    return this.http.get<T>(`${API_BASE_URL}${path}`, {
      params: httpParams,
      withCredentials: true,
    });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${API_BASE_URL}${path}`, body, {
      withCredentials: true,
    });
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${API_BASE_URL}${path}`, body, {
      withCredentials: true,
    });
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${API_BASE_URL}${path}`, {
      withCredentials: true,
    });
  }
}
