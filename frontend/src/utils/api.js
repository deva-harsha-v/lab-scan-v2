if (!import.meta.env.VITE_API_BASE) {
  throw new Error("FATAL: Environment variable VITE_API_BASE is required but missing at build time. Ensure VITE_API_BASE is defined in your environment or .env file before building.");
}

const API_BASE = import.meta.env.VITE_API_BASE + '/api';

// Module-scoped state for synchronizing token refresh and preventing duplicate logouts
let isLoggingOut = false;
let refreshPromise = null;

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export function getAccessToken() {
  return sessionStorage.getItem('accessToken');
}

export function getRefreshToken() {
  return null;
}

export function getUser() {
  const userStr = sessionStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

export function setSession(accessToken, refreshToken, user) {
  // Overload to support setSession(user)
  let userObj = user;
  let accessTok = accessToken;
  if (!user && accessToken && typeof accessToken === 'object') {
    userObj = accessToken;
    accessTok = null;
  }
  if (userObj) {
    sessionStorage.setItem('user', JSON.stringify(userObj));
  }
  if (accessTok && typeof accessTok === 'string') {
    sessionStorage.setItem('accessToken', accessTok);
  }
}

export function clearSession(skipServerLogout = false) {
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('accessToken');
  if (!skipServerLogout) {
    // Trigger background logout on the server to clear cookies and revoke refresh token
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  }
}

export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  // Set default headers
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // Attach Access Token if it exists
  const accessToken = getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Attach CSRF token if cookie exists
  const csrfToken = getCookie('csrfToken');
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const fetchOptions = {
    ...options,
    headers,
    credentials: 'include' // Required for sending/receiving HttpOnly cookies
  };

  let response = await fetch(url, fetchOptions);

  // If unauthorized/forbidden, attempt token refresh
  if (response.status === 401 || response.status === 403) {
    // Avoid infinite loop if auth endpoints fail
    if (endpoint !== '/auth/refresh' && endpoint !== '/auth/login') {
      try {
        // Synchronize parallel refresh requests to hit the endpoint only once
        if (!refreshPromise) {
          refreshPromise = (async () => {
            const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken || ''
              },
              credentials: 'include'
            });

            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json();
              if (refreshData.user) {
                setSession(refreshData.accessToken, null, refreshData.user);
              }
              return refreshData.accessToken || null;
            } else {
              // Only clear session and redirect if the refresh token is explicitly expired/unauthorized
              if (refreshResponse.status === 401 || refreshResponse.status === 403) {
                if (!isLoggingOut) {
                  isLoggingOut = true;
                  await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
                  clearSession(true); // Skip server logout since we just called it above
                  const isAdmin = window.location.hash.includes('/admin') || window.location.pathname.startsWith('/admin');
                  const redirectPath = isAdmin ? '/admin/login?reason=device' : '/login?reason=device';
                  window.location.href = redirectPath;
                }
                return new Promise(() => {}); // Return a pending promise so the calling page stops processing during redirect
              }
              throw new Error(`Session refresh failed with status ${refreshResponse.status}`);
            }
          })();
        }

        const newAccessToken = await refreshPromise;
        // Reset promise so subsequent expirations can trigger a new refresh flow
        refreshPromise = null;

        // Re-fetch CSRF token in case it was rotated
        const newCsrfToken = getCookie('csrfToken');
        if (newCsrfToken) {
          headers['X-CSRF-Token'] = newCsrfToken;
        }

        // Update Authorization header with new token
        if (newAccessToken) {
          headers['Authorization'] = `Bearer ${newAccessToken}`;
          fetchOptions.headers = headers;
        }
        
        // Retry original request
        response = await fetch(url, fetchOptions);
      } catch (err) {
        refreshPromise = null;
        console.error('Session refresh failed due to network or server error:', err);
        throw err; // Propagate connection/network/server errors, do NOT log out the user
      }
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}
