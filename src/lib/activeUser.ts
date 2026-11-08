const STORAGE_KEY = 'gmb.activeUserId';

export function getActiveUserId(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setActiveUserId(id: string | null): void {
  if (id) {
    window.localStorage.setItem(STORAGE_KEY, id);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
