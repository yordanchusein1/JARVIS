import { redirect } from 'next/navigation';
import { isSignedIn } from '@/lib/auth';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await isSignedIn()) redirect('/');
  return <LoginForm />;
}
