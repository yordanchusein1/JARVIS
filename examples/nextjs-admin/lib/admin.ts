/**
 * Stand-in for your admin sign-in. This example uses HTTP Basic authentication with one password
 * so it runs without setup; in your own admin, check your existing session here instead
 * (NextAuth, Clerk, Supabase, your own cookie…).
 */
export function isAdmin(authorization: string | null): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !authorization?.startsWith('Basic ')) return false;
  const [, given] = atob(authorization.slice(6)).split(':');
  return given === password;
}
