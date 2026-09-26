import {
  boolean,
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

// How a business entered Arclight. For `places`, only the place_id may be stored (see docs/DECISIONS.md, D3).
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

// A person's judgement of a lead, used to calibrate scoring.
export const leadFeedback = pgEnum('lead_feedback', ['good', 'bad']);

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

// A saved Google Places search that Arclight runs every day to find new leads on its own.
export const hunts = pgTable('hunts', {
  id: uuid('id').primaryKey().defaultRandom(),
  query: text('query').notNull(),
  active: boolean('active').notNull().default(true),
  // Local hour (in the agency's time zone) at which the hunt runs each day.
  runHour: integer('run_hour').notNull().default(7),
  maxNewPerRun: integer('max_new_per_run').notNull().default(10),
  // Skip places with fewer Google reviews. Checked live during the run and never stored (D9).
  minReviews: integer('min_reviews').notNull().default(0),
  includeNoWebsite: boolean('include_no_website').notNull().default(true),
  // Write drafts for new leads whose priority reaches autoDraftMinPriority. Nothing is sent.
  autoDraft: boolean('auto_draft').notNull().default(false),
  autoDraftMinPriority: integer('auto_draft_min_priority').notNull().default(50),
  // The daily slot the last scheduled run was for, so each slot runs once.
  lastScheduledFor: timestamp('last_scheduled_for', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const huntRunStatus = pgEnum('hunt_run_status', ['running', 'succeeded', 'failed']);
export const huntTrigger = pgEnum('hunt_trigger', ['schedule', 'manual']);

export const huntRuns = pgTable(
  'hunt_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    huntId: uuid('hunt_id')
      .notNull()
      .references(() => hunts.id, { onDelete: 'cascade' }),
    trigger: huntTrigger('trigger').notNull(),
    status: huntRunStatus('status').notNull().default('running'),
    error: text('error'),
    // Places Google returned, places skipped because they were already tracked, places left out
    // by the hunt's filters or the do-not-contact list, and new businesses tracked.
    found: integer('found').notNull().default(0),
    alreadyTracked: integer('already_tracked').notNull().default(0),
    excluded: integer('excluded').notNull().default(0),
    tracked: integer('tracked').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('hunt_runs_hunt_id_idx').on(t.huntId, t.startedAt)],
);

export const businesses = pgTable('businesses', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: businessSource('source').notNull(),
  // The hunt that found this business, if any.
  huntId: uuid('hunt_id').references(() => hunts.id, { onDelete: 'set null' }),
  placeId: text('place_id').unique(),
  websiteUrl: text('website_url'),
  // Normalised form of the website used for de-duplication (host without "www." plus path).
  websiteKey: text('website_key').unique(),
  // Name as published on the business's own website, never copied from Google.
  displayName: text('display_name'),
  status: leadStatus('status').notNull().default('new'),
  feedback: leadFeedback('feedback'),
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
    // Things the user should know about how the audit ran, e.g. a check that was skipped.
    notes: text('notes').array().notNull().default([]),
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

// A single row describing the agency, used to write outreach in its name and voice.
export const agencyProfile = pgTable('agency_profile', {
  id: text('id').primaryKey().default('default'),
  agencyName: text('agency_name').notNull().default(''),
  senderName: text('sender_name').notNull().default(''),
  services: text('services').notNull().default(''),
  tone: text('tone').notNull().default('friendly and professional'),
  // Language drafts are written in, as a BCP 47 tag such as "id" or "en".
  language: text('language').notNull().default('id'),
  // Points per signal key that replace the built-in defaults, e.g. { "no_https": 10 }.
  scoringWeights: jsonb('scoring_weights').$type<Record<string, number>>().notNull().default({}),
  // IANA time zone for hunt schedules and the daily briefing.
  timezone: text('timezone').notNull().default('Asia/Jakarta'),
  // Days after which a contacted lead without a reply shows up as a follow-up.
  followUpDays: integer('follow_up_days').notNull().default(3),
  // Stops scheduled hunts from running; manual runs and audits still work.
  automationPaused: boolean('automation_paused').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const draftChannel = pgEnum('draft_channel', ['whatsapp', 'email']);

export const drafts = pgTable(
  'drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    auditId: uuid('audit_id').references(() => audits.id, { onDelete: 'set null' }),
    channel: draftChannel('channel').notNull(),
    subject: text('subject'),
    body: text('body').notNull(),
    // Automatic checks a person should look at before sending, e.g. a number not backed by evidence.
    warnings: text('warnings').array().notNull().default([]),
    model: text('model').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('drafts_business_id_idx').on(t.businessId)],
);
