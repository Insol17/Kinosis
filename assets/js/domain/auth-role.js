export function roleForUser(user) {
  const raw = String(user?.app_metadata?.user_role || user?.app_metadata?.role || '').toLowerCase();
  return raw === 'admin' ? 'admin' : 'user';
}

export function isAdminUser(user) {
  return roleForUser(user) === 'admin';
}
