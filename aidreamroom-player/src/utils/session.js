import { localStorageKey } from '../constant/localStorageKey';
import { setUserId } from '../constant/userInfo';
import { API, setHeader } from './API';

function createAuthedState(token = '', id = '') {
  return {
    checked: true,
    token,
    id,
  };
}

function createPendingAuthState() {
  return {
    checked: false,
    token: '',
    id: '',
  };
}

function createValueCache() {
  return {
    checked: false,
    token: '',
    value: null,
  };
}

function createRoleCache() {
  return {
    checked: false,
    token: '',
    hasRole: false,
  };
}

function createRequestState() {
  return {
    token: '',
    promise: null,
  };
}

let authCache = createPendingAuthState();
let authRequest = createRequestState();
let roleCache = createRoleCache();
let roleRequest = createRequestState();
let roleProfileCache = createValueCache();
let roleProfileRequest = createRequestState();
let userInfoCache = createValueCache();
let userInfoRequest = createRequestState();
let userDetailCache = createValueCache();
let userDetailRequest = createRequestState();
let skillListCache = createValueCache();
let skillListRequest = createRequestState();
let itemListCache = createValueCache();
let itemListRequest = createRequestState();
let warehouseProfileCache = createValueCache();
let warehouseProfileRequest = createRequestState();

function getStoredToken() {
  return localStorage.getItem(localStorageKey.LOGIN_TOKEN) || '';
}

function clearRoleCaches() {
  roleCache = createRoleCache();
  roleRequest = createRequestState();
  roleProfileCache = createValueCache();
  roleProfileRequest = createRequestState();
}

function clearUserCaches() {
  userInfoCache = createValueCache();
  userInfoRequest = createRequestState();
  userDetailCache = createValueCache();
  userDetailRequest = createRequestState();
}

function clearSkillCaches() {
  skillListCache = createValueCache();
  skillListRequest = createRequestState();
}

function clearItemCaches() {
  itemListCache = createValueCache();
  itemListRequest = createRequestState();
}

function clearWarehouseCaches() {
  warehouseProfileCache = createValueCache();
  warehouseProfileRequest = createRequestState();
}

function clearDataCaches() {
  clearRoleCaches();
  clearUserCaches();
  clearSkillCaches();
  clearItemCaches();
  clearWarehouseCaches();
}

function applyAuthState(token, id = '') {
  setHeader(token);
  setUserId(id || '');
  authCache = createAuthedState(token, id || '');
  return authCache;
}

function applyRoleExists(token, hasRole) {
  roleCache = {
    checked: true,
    token,
    hasRole: !!hasRole,
  };

  if (!hasRole) {
    roleProfileCache = {
      checked: true,
      token,
      value: { role: null },
    };
  }

  return {
    checked: true,
    hasRole: !!hasRole,
  };
}

function applyRoleProfile(token, response) {
  const nextResponse = response || { role: null };
  const hasRole = !!nextResponse.role;

  roleProfileCache = {
    checked: true,
    token,
    value: nextResponse,
  };

  roleCache = {
    checked: true,
    token,
    hasRole,
  };

  return nextResponse;
}

function applyUserInfo(token, response) {
  const value = response?.result || null;
  userInfoCache = {
    checked: true,
    token,
    value,
  };
  return value;
}

function applyUserDetail(token, response) {
  const value = response || null;
  userDetailCache = {
    checked: true,
    token,
    value,
  };
  return value;
}

export function clearSessionState({ clearStorage = false } = {}) {
  if (clearStorage) {
    localStorage.removeItem(localStorageKey.LOGIN_TOKEN);
  }

  setHeader('');
  setUserId('');
  authCache = createAuthedState('', '');
  authRequest = createRequestState();
  clearDataCaches();

  return authCache;
}

export function commitLoginSession(token, id = '') {
  if (!token) {
    return clearSessionState({ clearStorage: true });
  }

  localStorage.setItem(localStorageKey.LOGIN_TOKEN, token);
  authRequest = createRequestState();

  if (authCache.token !== token) {
    clearDataCaches();
  }

  return applyAuthState(token, id);
}

export function getCachedAuthState() {
  const storedToken = getStoredToken();

  if (!storedToken) {
    return createAuthedState('', '');
  }

  if (authCache.checked && authCache.token === storedToken) {
    return authCache;
  }

  return createPendingAuthState();
}

export async function ensureAuthState({ force = false } = {}) {
  const storedToken = getStoredToken();

  if (!storedToken) {
    return clearSessionState();
  }

  if (!force && authCache.checked && authCache.token === storedToken) {
    return authCache;
  }

  if (!force && authRequest.promise && authRequest.token === storedToken) {
    return authRequest.promise;
  }

  authRequest = {
    token: storedToken,
    promise: (async () => {
      try {
        const response = await API.TOKEN_CHECK({ session_token: storedToken });
        if (response?.result !== 0) {
          return clearSessionState({ clearStorage: true });
        }

        return applyAuthState(storedToken, response?.id || '');
      } catch (error) {
        return clearSessionState({ clearStorage: true });
      } finally {
        if (authRequest.token === storedToken) {
          authRequest.promise = null;
        }
      }
    })(),
  };

  return authRequest.promise;
}

export function getCachedRoleState(token = getStoredToken()) {
  if (!token) {
    return {
      checked: true,
      hasRole: true,
    };
  }

  if (roleCache.checked && roleCache.token === token) {
    return {
      checked: true,
      hasRole: roleCache.hasRole,
    };
  }

  return {
    checked: false,
    hasRole: true,
  };
}

export async function ensureRoleExists({ force = false } = {}) {
  const auth = await ensureAuthState();

  if (!auth.token) {
    return {
      checked: true,
      hasRole: false,
    };
  }

  if (!force && roleCache.checked && roleCache.token === auth.token) {
    return {
      checked: true,
      hasRole: roleCache.hasRole,
    };
  }

  if (!force && roleRequest.promise && roleRequest.token === auth.token) {
    return roleRequest.promise;
  }

  roleRequest = {
    token: auth.token,
    promise: (async () => {
      try {
        const response = await API.USER_ROLE_EXISTS();
        return applyRoleExists(auth.token, !!response?.exists);
      } catch (error) {
        roleCache = {
          checked: true,
          token: auth.token,
          hasRole: true,
        };
        return {
          checked: true,
          hasRole: true,
        };
      } finally {
        if (roleRequest.token === auth.token) {
          roleRequest.promise = null;
        }
      }
    })(),
  };

  return roleRequest.promise;
}

export function getCachedRoleProfile() {
  const token = getStoredToken();

  if (token && roleProfileCache.checked && roleProfileCache.token === token) {
    return roleProfileCache.value;
  }

  return null;
}

export async function ensureRoleProfile({ force = false } = {}) {
  const auth = await ensureAuthState();

  if (!auth.token) {
    return { role: null };
  }

  if (!force && roleProfileCache.checked && roleProfileCache.token === auth.token) {
    return roleProfileCache.value;
  }

  if (!force && roleProfileRequest.promise && roleProfileRequest.token === auth.token) {
    return roleProfileRequest.promise;
  }

  roleProfileRequest = {
    token: auth.token,
    promise: (async () => {
      try {
        const response = await API.USER_ROLE_PROFILE();
        return applyRoleProfile(auth.token, response);
      } finally {
        if (roleProfileRequest.token === auth.token) {
          roleProfileRequest.promise = null;
        }
      }
    })(),
  };

  return roleProfileRequest.promise;
}

export function markRoleCreated() {
  const token = getStoredToken();

  if (!token) {
    return;
  }

  roleCache = {
    checked: true,
    token,
    hasRole: true,
  };
  roleRequest = createRequestState();
  roleProfileCache = createValueCache();
  roleProfileRequest = createRequestState();
  clearSkillCaches();
  clearItemCaches();
  clearWarehouseCaches();
}

export function getCachedUserInfo() {
  const token = getStoredToken();

  if (token && userInfoCache.checked && userInfoCache.token === token) {
    return userInfoCache.value;
  }

  return null;
}

export async function ensureUserInfo({ force = false } = {}) {
  const auth = await ensureAuthState();

  if (!auth.token) {
    return null;
  }

  if (!force && userInfoCache.checked && userInfoCache.token === auth.token) {
    return userInfoCache.value;
  }

  if (!force && userInfoRequest.promise && userInfoRequest.token === auth.token) {
    return userInfoRequest.promise;
  }

  userInfoRequest = {
    token: auth.token,
    promise: (async () => {
      try {
        const response = await API.QUERY_INFO();
        return applyUserInfo(auth.token, response);
      } finally {
        if (userInfoRequest.token === auth.token) {
          userInfoRequest.promise = null;
        }
      }
    })(),
  };

  return userInfoRequest.promise;
}

export function getCachedUserDetail() {
  const token = getStoredToken();

  if (token && userDetailCache.checked && userDetailCache.token === token) {
    return userDetailCache.value;
  }

  return null;
}

export async function ensureUserDetail({ force = false } = {}) {
  const auth = await ensureAuthState();

  if (!auth.token) {
    return null;
  }

  if (!force && userDetailCache.checked && userDetailCache.token === auth.token) {
    return userDetailCache.value;
  }

  if (!force && userDetailRequest.promise && userDetailRequest.token === auth.token) {
    return userDetailRequest.promise;
  }

  userDetailRequest = {
    token: auth.token,
    promise: (async () => {
      try {
        const response = await API.USERS_QUERY_MORE_DETAIL();
        return applyUserDetail(auth.token, response);
      } finally {
        if (userDetailRequest.token === auth.token) {
          userDetailRequest.promise = null;
        }
      }
    })(),
  };

  return userDetailRequest.promise;
}

export function getCachedSkillList() {
  const token = getStoredToken();

  if (token && skillListCache.checked && skillListCache.token === token) {
    return skillListCache.value;
  }

  return null;
}

export async function ensureSkillList({ force = false } = {}) {
  const auth = await ensureAuthState();

  if (!auth.token) {
    return [];
  }

  if (!force && skillListCache.checked && skillListCache.token === auth.token) {
    return skillListCache.value || [];
  }

  if (!force && skillListRequest.promise && skillListRequest.token === auth.token) {
    return skillListRequest.promise;
  }

  skillListRequest = {
    token: auth.token,
    promise: (async () => {
      try {
        const response = await API.SKILL_LIST();
        const value = response?.list || [];
        skillListCache = {
          checked: true,
          token: auth.token,
          value,
        };
        return value;
      } finally {
        if (skillListRequest.token === auth.token) {
          skillListRequest.promise = null;
        }
      }
    })(),
  };

  return skillListRequest.promise;
}

export function getCachedItemList() {
  const token = getStoredToken();

  if (token && itemListCache.checked && itemListCache.token === token) {
    return itemListCache.value;
  }

  return null;
}

export async function ensureItemList({ force = false } = {}) {
  const auth = await ensureAuthState();

  if (!auth.token) {
    return [];
  }

  if (!force && itemListCache.checked && itemListCache.token === auth.token) {
    return itemListCache.value || [];
  }

  if (!force && itemListRequest.promise && itemListRequest.token === auth.token) {
    return itemListRequest.promise;
  }

  itemListRequest = {
    token: auth.token,
    promise: (async () => {
      try {
        const response = await API.ITEM_LIST();
        const value = response?.list || [];
        itemListCache = {
          checked: true,
          token: auth.token,
          value,
        };
        return value;
      } finally {
        if (itemListRequest.token === auth.token) {
          itemListRequest.promise = null;
        }
      }
    })(),
  };

  return itemListRequest.promise;
}

function applyWarehouseProfile(token, profile) {
  const value = profile || null;
  warehouseProfileCache = {
    checked: true,
    token,
    value,
  };
  return value;
}

export function getCachedWarehouseProfile() {
  const token = getStoredToken();

  if (token && warehouseProfileCache.checked && warehouseProfileCache.token === token) {
    return warehouseProfileCache.value;
  }

  return null;
}

export async function ensureWarehouseProfile({ force = false } = {}) {
  const auth = await ensureAuthState();

  if (!auth.token) {
    return null;
  }

  if (!force && warehouseProfileCache.checked && warehouseProfileCache.token === auth.token) {
    return warehouseProfileCache.value;
  }

  if (!force && warehouseProfileRequest.promise && warehouseProfileRequest.token === auth.token) {
    return warehouseProfileRequest.promise;
  }

  warehouseProfileRequest = {
    token: auth.token,
    promise: (async () => {
      try {
        const response = await API.WAREHOUSE_PROFILE();
        return applyWarehouseProfile(auth.token, response?.profile || null);
      } finally {
        if (warehouseProfileRequest.token === auth.token) {
          warehouseProfileRequest.promise = null;
        }
      }
    })(),
  };

  return warehouseProfileRequest.promise;
}

export function commitWarehouseProfile(profile) {
  const token = getStoredToken();

  if (!token) {
    return null;
  }

  return applyWarehouseProfile(token, profile);
}

export function clearWarehouseProfileCache() {
  clearWarehouseCaches();
}
