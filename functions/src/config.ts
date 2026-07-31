import type { ReceiptRules } from './receipts/core/rules.config';
import { receiptRules } from './receipts/core/rules.config';



/** Singapore — lowest latency for PH users. */
export const REGION = 'asia-southeast1';


export const RUNTIME_OPTS = {
  region: REGION,
  maxInstances: 10,
  timeoutSeconds: 60, // Vision returns in 1-3s; 60 is generous
  memory: '512MiB',
} as const;


export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;


export const MAX_OCR_WORDS = 4000;

/** How long a scan session stays claimable. Matches the Firestore TTL policy on `expires_at`. */
export const SESSION_TTL_MINUTES = 15;

/** Collection names, in one place so the repos and the rules cannot drift apart. */
export const COLLECTIONS = {
  receipts: 'receipts',
  stamps: 'stamps',
  scanSessions: 'scan_sessions',
  rateLimits: 'rate_limits',
  merchants: 'merchants',
  users: 'users',
} as const;


export const DEFAULT_STAMP_CARD = {
  stampCard_configs: { bgColor: '#fff', seed: 1, title: 'Stamp Card' },
  stamp_count: 0,
  stamp_total: 10,
  stamp_reward_index: [4, 9],
} as const;

/** The rules the deployed functions validate against. */
export function activeRules(): ReceiptRules {
  return receiptRules;
}
