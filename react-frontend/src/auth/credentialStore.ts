export interface Credential {
  username: string;
  password: string;
}

type Listener = () => void;

let credential: Credential | null = null;
const listeners = new Set<Listener>();

export function getCredential(): Credential | null {
  return credential;
}

export function setCredential(next: Credential): void {
  credential = next;
  listeners.forEach((listener) => listener());
}

export function clearCredential(): void {
  credential = null;
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
