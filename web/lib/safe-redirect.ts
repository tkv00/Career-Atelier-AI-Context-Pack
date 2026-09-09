export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return '/dashboard';
  try {
    return new URL(value, 'https://local.invalid').origin === 'https://local.invalid' ? value : '/dashboard';
  } catch {
    return '/dashboard';
  }
}
