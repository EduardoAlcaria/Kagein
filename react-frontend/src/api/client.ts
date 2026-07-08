import { authFetch } from '../auth/authFetch';
import type {
  AccountStatusResponse,
  AlertEventDto,
  PersonLocationDto,
  PersonSummaryDto,
  RegisterAccountRequest,
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
