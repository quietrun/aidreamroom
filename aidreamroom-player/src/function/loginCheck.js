import { clearSessionState, ensureAuthState } from '../utils/session';

export async function clearLogin(options = {}) {
  return clearSessionState(options);
}

export async function tokenCheck(options = {}) {
  return ensureAuthState(options);
}
