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
  zoneId: number | null;
  type: string;
  message: string;
  triggeredAt: string;
}

export type ZoneShape = 'CIRCLE' | 'POLYGON';
export type ZoneTrigger = 'ENTER' | 'LEAVE' | 'INSIDE';

export interface PointDto {
  id: number;
  label: string;
  latitude: number;
  longitude: number;
}

export interface ZoneDto {
  id: number;
  poiId: number;
  shape: ZoneShape;
  radiusMeters: number | null;
  vertices: string | null; // JSON "[[lat,lon],...]"
  trigger: ZoneTrigger;
  color: string;
  alarmMessage: string;
}

export interface CreatePointRequest {
  label: string;
  latitude: number;
  longitude: number;
}

export interface CreateZoneRequest {
  poiId: number;
  shape: ZoneShape;
  radiusMeters?: number;
  vertices?: string;
  trigger: ZoneTrigger;
  color: string;
  alarmMessage: string;
}

export interface RegisterAccountRequest {
  appleId: string;
  password: string;
}

export interface AccountStatusResponse {
  status: 'active' | '2fa_required';
}
