import { getJarvis } from '@/lib/jarvis';
import { ProfileForm } from './profile-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const jarvis = getJarvis();
  if (!jarvis) return <p className="error">The dashboard is not connected to the JARVIS API.</p>;
  const { data, error } = await jarvis.GET('/agency-profile');
  if (!data) return <p className="error">Could not load the profile: {error?.error.message}</p>;

  return (
    <>
      <h1>Agency profile</h1>
      <p className="muted">
        JARVIS writes outreach in your agency&apos;s name and voice using this profile.
      </p>
      <ProfileForm profile={data} />
    </>
  );
}
