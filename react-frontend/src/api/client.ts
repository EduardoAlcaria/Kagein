import { authFetch } from '../auth/authFetch';
import type {
  AccountStatusResponse,
  AlertEventDto,
  CreatePointRequest,
  CreateZoneRequest,
  PersonLocationDto,
  PersonSummaryDto,
  PointDto,
  RegisterAccountRequest,
  ZoneDto,
} from './types';

export async function fetchPeople(): Promise<PersonSummaryDto[]> {
  const response = await authFetch('/api/people');
  return response.json();
}

export async function fetchPersonLocations(personId: number): Promise<PersonLocationDto[]> {
  const response = await authFetch(`/api/people/${personId}/locations`);
  return response.json();
}

export async function fetchAlerts(): Promise<AlertEventDto[]> {
  const response = await authFetch('/api/alerts');
  return response.json();
}

export async function registerAccount(
  request: RegisterAccountRequest,
): Promise<AccountStatusResponse> {
  const response = await authFetch('/api/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return response.json();
}

export async function submitTwoFactorCode(
  appleId: string,
  code: string,
): Promise<AccountStatusResponse> {
  const response = await authFetch(`/api/accounts/${encodeURIComponent(appleId)}/2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return response.json();
}

export async function fetchPoints(): Promise<PointDto[]> {
  const response = await authFetch('/api/points');
  return response.json();
}

export async function createPoint(request: CreatePointRequest): Promise<PointDto> {
  const response = await authFetch('/api/points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return response.json();
}

export async function deletePoint(id: number): Promise<void> {
  await authFetch(`/api/points/${id}`, { method: 'DELETE' });
}

export async function fetchZones(): Promise<ZoneDto[]> {
  const response = await authFetch('/api/zones');
  return response.json();
}

export async function createZone(request: CreateZoneRequest): Promise<ZoneDto> {
  const response = await authFetch('/api/zones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return response.json();
}

export async function deleteZone(id: number): Promise<void> {
  await authFetch(`/api/zones/${id}`, { method: 'DELETE' });
}
