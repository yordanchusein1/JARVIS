import { agencyProfile } from './db/schema.ts';
import type { Database } from './db/client.ts';

export type AgencyProfile = Omit<typeof agencyProfile.$inferSelect, 'id'>;
export type AgencyProfileUpdate = Partial<Omit<AgencyProfile, 'updatedAt'>>;

const DEFAULTS: AgencyProfile = {
  agencyName: '',
  senderName: '',
  services: '',
  tone: 'friendly and professional',
  language: 'id',
  scoringWeights: {},
  updatedAt: new Date(0),
};

export async function getAgencyProfile(db: Database): Promise<AgencyProfile> {
  const [row] = await db.select().from(agencyProfile);
  if (!row) return DEFAULTS;
  const { id: _id, ...profile } = row;
  return profile;
}

export async function updateAgencyProfile(
  db: Database,
  update: AgencyProfileUpdate,
): Promise<AgencyProfile> {
  const values = { ...update, updatedAt: new Date() };
  const [row] = await db
    .insert(agencyProfile)
    .values({ id: 'default', ...values })
    .onConflictDoUpdate({ target: agencyProfile.id, set: values })
    .returning();
  const { id: _id, ...profile } = row!;
  return profile;
}

/** Fields that must be filled in before Arclight can write outreach in the agency's name. */
export function missingProfileFields(profile: AgencyProfile): string[] {
  return (['agencyName', 'senderName', 'services'] as const).filter((k) => !profile[k].trim());
}
