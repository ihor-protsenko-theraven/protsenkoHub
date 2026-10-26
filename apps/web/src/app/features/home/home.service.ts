import { httpResource } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_BASE_URL } from '../../core/configs/api.config';
import { HomeSnapshot } from './home.model';

@Injectable()
export class HomeService {
  readonly snapshot = httpResource<HomeSnapshot>(() => ({
    url: `${API_BASE_URL}/home`,
    withCredentials: true,
  }));
}
