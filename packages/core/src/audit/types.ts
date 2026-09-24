export type SignalAxis = 'need' | 'capacity';

/** A measured fact about a business. `evidence` is written so a draft message may quote it. */
export interface SignalInput {
  axis: SignalAxis;
  key: string;
  points: number;
  evidence: string;
  data?: Record<string, unknown>;
}

export type ContactKind =
  'email' | 'phone' | 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'other';

export interface ContactInput {
  kind: ContactKind;
  value: string;
  sourceUrl: string;
}
