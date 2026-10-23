import { httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { API_BASE_URL } from '../../core/configs/api.config';
import { TaskItem, TaskPayload } from './children.model';

@Injectable()
export class ChildrenService {
  private readonly api = inject(ApiService);
  readonly tasks = httpResource<TaskItem[]>(
    () => ({ url: `${API_BASE_URL}/children/tasks`, withCredentials: true }),
    { defaultValue: [] },
  );

  create(payload: TaskPayload) {
    return this.api.post<TaskItem>('/children/tasks', payload).pipe(tap(() => this.tasks.reload()));
  }

  update(id: string, payload: Partial<TaskPayload>) {
    return this.api.patch<TaskItem>(`/children/tasks/${id}`, payload).pipe(tap(() => this.tasks.reload()));
  }

  remove(id: string) {
    return this.api.delete<void>(`/children/tasks/${id}`).pipe(tap(() => this.tasks.reload()));
  }
}
