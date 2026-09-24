import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const leadStatus = pgEnum('lead_status', [
  'new',
  'contacted',
  'replied',
  'meeting',
  'won',
  'lost',
]);

// How a business entered JARVIS. For `places`, only the place_id may be stored (see docs/DECISIONS.md, D3).
export const businessSource = pgEnum('business_source', ['url', 'csv', 'places']);

export const auditStatus = pgEnum('audit_status', ['queued', 'running', 'succeeded', 'failed']);

export const signalAxis = pgEnum('signal_axis', ['need', 'capacity']);

export const contactKind = pgEnum('contact_kind', [
  'email',
  'phone',
  'whatsapp',
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'other',
]);

export const doNotContactKind = pgEnum('do_not_contact_kind', ['domain', 'email', 'phone']);

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // First characters of the key, shown in listings so keys can be told apart without revealing them.
  prefix: text('prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  createdAt: createdAt(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const businesses = pgTable('businesses', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: businessSource('source').notNull(),
  placeId: text('place_id').unique(),
  websiteUrl: text('website_url'),
  // Normalised form of the website used for de-duplication (host without "www." plus path).
  websiteKey: text('website_key').unique(),
  // Name as published on the business's own website, never copied from Google.
  displayName: text('display_name'),
  status: leadStatus('status').notNull().default('new'),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const audits = pgTable(
  'audits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    status: auditStatus('status').notNull().default('queued'),
    error: text('error'),
    needScore: integer('need_score'),
    capacityScore: integer('capacity_score'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('audits_business_id_idx').on(t.businessId)],
);

// One measured fact about a business, with the human-readable evidence that drafts may cite.
export const signals = pgTable(
  'signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    auditId: uuid('audit_id')
      .notNull()
      .references(() => audits.id, { onDelete: 'cascade' }),
    axis: signalAxis('axis').notNull(),
    key: text('key').notNull(),
    points: integer('points').notNull(),
    evidence: text('evidence').notNull(),
    data: jsonb('data'),
    createdAt: createdAt(),
  },
  (t) => [index('signals_audit_id_idx').on(t.auditId)],
);

export const contactChannels = pgTable(
  'contact_channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    kind: contactKind('kind').notNull(),
    value: text('value').notNull(),
    // Page on the business's website where this channel was published.
    sourceUrl: text('source_url'),
    createdAt: createdAt(),
  },
  (t) => [unique('contact_channels_business_kind_value').on(t.businessId, t.kind, t.value)],
);

export const activityLog = pgTable(
  'activity_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    details: jsonb('details'),
    createdAt: createdAt(),
  },
  (t) => [index('activity_log_business_id_idx').on(t.businessId)],
);

export const doNotContact = pgTable(
  'do_not_contact',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: doNotContactKind('kind').notNull(),
    value: text('value').notNull(),
    reason: text('reason'),
    createdAt: createdAt(),
  },
  (t) => [unique('do_not_contact_kind_value').on(t.kind, t.value)],
);
