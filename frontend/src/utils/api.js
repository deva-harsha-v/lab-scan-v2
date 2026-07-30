const API_BASE = (import.meta.env.VITE_API_BASE || ('http://localhost' + ':5000')) + '/api';

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export function getAccessToken() {
  return null;
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
  if (!user && accessToken && typeof accessToken === 'object') {
    userObj = accessToken;
  }
  if (userObj) {
    sessionStorage.setItem('user', JSON.stringify(userObj));
  }
}

export function clearSession() {
  sessionStorage.removeItem('user');
  // Trigger background logout on the server to clear cookies and revoke refresh token
  fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
}

export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  // Set default headers
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

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
            setSession(refreshData.user);
          }
          
          // Re-fetch CSRF token in case it was rotated
          const newCsrfToken = getCookie('csrfToken');
          if (newCsrfToken) {
            headers['X-CSRF-Token'] = newCsrfToken;
          }
          
          // Retry original request
          response = await fetch(url, fetchOptions);
        } else {
          // Refresh token expired or invalid, log out
          await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
          clearSession();
          const redirectPath = window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
          window.location.href = redirectPath;
        }
      } catch (err) {
        console.error('Session refresh failed:', err);
        clearSession();
        const redirectPath = window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
        window.location.href = redirectPath;
      }
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}
