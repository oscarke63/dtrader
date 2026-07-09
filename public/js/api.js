const API = window.location.origin + '/api';

function getToken() { return localStorage.getItem('dt_token'); }
function setToken(t) { localStorage.setItem('dt_token', t); }
function clearToken() { localStorage.removeItem('dt_token'); }
function isLoggedIn() { return !!getToken(); }

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  const t = getToken();
  if (t) opts.headers['Authorization'] = `Bearer ${t}`;
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(API + path, opts);
    const data = await res.json();
    if (res.status === 401) { clearToken(); window.location.href = '/'; }
    return data;
  } catch(e) {
    return { success: false, message: 'Network error. Check your connection.' };
  }
}

// Auth
async function register(email, password, name, phone) {
  const d = await api('POST', '/auth/register', { email, password, name, phone });
  if (d.success) setToken(d.token);
  return d;
}
async function login(email, password) {
  const d = await api('POST', '/auth/login', { email, password });
  if (d.success) setToken(d.token);
  return d;
}
function logout() { clearToken(); window.location.href = '/'; }

// Accounts
async function getAccounts() { return api('GET', '/accounts'); }
async function resetDemo() { return api('POST', '/accounts/reset-demo'); }

// Deposits
async function depositMpesa(amount, phone) {
  return api('POST', '/deposits/mpesa', { amount: parseFloat(amount), phone });
}
async function getDepositStatus(ref) { return api('GET', '/deposits/status/' + ref); }
async function getDepositHistory() { return api('GET', '/deposits/history'); }

// Trades
async function placeTrade(data) { return api('POST', '/trades', data); }
async function settleTrade(id, data) { return api('POST', `/trades/${id}/settle`, data); }
async function getTradeHistory() { return api('GET', '/trades/history'); }