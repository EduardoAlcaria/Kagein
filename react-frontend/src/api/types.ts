export interface PersonLocationDto {
  latitude: number | null;
  longitude: number | null;
  capturedAt: string;
}

export interface PersonSummaryDto {
  id: number;
  name: string;
  latest: PersonLocationDto | null;
}

export interface AlertEventDto {
  id: number;
  personId: number;
  type: string;
  message: string;
  triggeredAt: string;
}

export interface RegisterAccountRequest {
  appleId: string;
  password: string;
}

export interface AccountStatusResponse {
  status: 'active' | '2fa_required';
}
