import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/people', () => HttpResponse.json([])),
  http.get('/api/alerts', () => HttpResponse.json([])),
];
