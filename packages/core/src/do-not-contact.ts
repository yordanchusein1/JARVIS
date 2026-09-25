import { and, asc, eq, inArray, or } from 'drizzle-orm';
import type { Database } from './db/client.ts';
import { activityLog, doNotContact } from './db/schema.ts';
import { normalizeWebsite } from './website.ts';

export type DoNotContactEntry = typeof doNotContact.$inferSelect;
export type DoNotContactKind = DoNotContactEntry['kind'];

export class InvalidDoNotContactError extends Error {
  override name = 'InvalidDoNotContactError';
}

/** Normalises an entry so the same domain, email or phone number always matches. */
export function normalizeDoNotContact(kind: DoNotContactKind, value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (kind === 'domain') {
    try {
      return domainOfKey(normalizeWebsite(trimmed).key)!;
    } catch (error) {
      throw new InvalidDoNotContactError((error as Error).message);
    }
  }
  if (kind === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new InvalidDoNotContactError('Not a valid email address');
    }
    return trimmed;
  }
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length < 6) throw new InvalidDoNotContactError('Not a valid phone number');
  return digits;
}

export async function addDoNotContact(
  db: Database,
  kind: DoNotContactKind,
  value: string,
  reason?: string,
): Promise<DoNotContactEntry> {
  const normalized = normalizeDoNotContact(kind, value);
  const [row] = await db
    .insert(doNotContact)
    .values({ kind, value: normalized, reason: reason ?? null })
    .onConflictDoUpdate({
      target: [doNotContact.kind, doNotContact.value],
      set: { reason: reason ?? null },
    })
    .returning();
  await db.insert(activityLog).values({
    action: 'do_not_contact.added',
    details: { kind, value: normalized },
  });
  return row!;
}

export async function removeDoNotContact(db: Database, id: string): Promise<boolean> {
  const rows = await db.delete(doNotContact).where(eq(doNotContact.id, id)).returning();
  return rows.length > 0;
}

export async function listDoNotContact(db: Database): Promise<DoNotContactEntry[]> {
  return db.select().from(doNotContact).orderBy(asc(doNotContact.kind), asc(doNotContact.value));
}

/** Which of the given domains, emails and phone numbers are on the list. */
export async function findDoNotContact(
  db: Database,
  {
    domains = [],
    emails = [],
    phones = [],
  }: { domains?: string[]; emails?: string[]; phones?: string[] },
): Promise<DoNotContactEntry[]> {
  const clauses = [
    domains.length && and(eq(doNotContact.kind, 'domain'), inArray(doNotContact.value, domains)),
    emails.length &&
      and(
        eq(doNotContact.kind, 'email'),
        inArray(
          doNotContact.value,
          emails.map((e) => e.toLowerCase()),
        ),
      ),
    // Phone numbers are compared in code, because the same number may be written with a
    // country code or a trunk "0" (see samePhone).
    phones.length && eq(doNotContact.kind, 'phone'),
  ].filter((c) => !!c);
  if (clauses.length === 0) return [];
  const rows = await db
    .select()
    .from(doNotContact)
    .where(or(...clauses));
  return rows.filter((e) => e.kind !== 'phone' || phones.some((p) => samePhone(e.value, p)));
}

/**
 * Whether two phone numbers are the same line, e.g. "0812 3456 7890" and "+62 812-3456-7890".
 * Numbers match when they are equal after dropping a trunk "0" and a country code of up to
 * three digits.
 */
export function samePhone(a: string, b: string): boolean {
  const national = (n: string) => n.replace(/[^\d]/g, '').replace(/^0+/, '');
  const x = national(a);
  const y = national(b);
  if (x === y) return x.length > 0;
  const [short, long] = x.length < y.length ? [x, y] : [y, x];
  return short.length >= 7 && long.length - short.length <= 3 && long.endsWith(short);
}

/** The registrable part of a website key, e.g. "klinik.co.id/cabang" → "klinik.co.id". */
export function domainOfKey(websiteKey: string | null): string | null {
  return websiteKey ? websiteKey.split('/')[0]!.split(':')[0]! : null;
}
