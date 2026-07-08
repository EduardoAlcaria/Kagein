import { clearCredential, getCredential } from './credentialStore';

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const credential = getCredential();
  const headers = new Headers(init.headers);
  if (credential) {
    headers.set('Authorization', `Basic ${btoa(`${credential.username}:${credential.password}`)}`);
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    clearCredential();
  }

  return response;
}
