/**
 * Security Rules Verification Suite (Dirty Dozen Payloads)
 * Documents and verifies expected PERMISSION_DENIED outcomes against DRAFT_firestore.rules.
 */
export interface DirtyDozenCase {
  id: number;
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authUid: string | null;
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const dirtyDozenCases: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated read of private player save',
    path: '/players/userA',
    operation: 'get',
    authUid: null,
    emailVerified: false,
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-user read of private player save',
    path: '/players/userB',
    operation: 'get',
    authUid: 'userA',
    emailVerified: true,
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Ghost field injection on player save create',
    path: '/players/userA',
    operation: 'create',
    authUid: 'userA',
    emailVerified: true,
    payload: { uid: 'userA', name: 'Piccolo', isAdmin: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'UID spoofing on public profile create',
    path: '/publicProfiles/userA',
    operation: 'create',
    authUid: 'userA',
    emailVerified: true,
    payload: { uid: 'userB', isPublic: true, name: 'Spoofer' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Client timestamp forgery on player save',
    path: '/players/userA',
    operation: 'create',
    authUid: 'userA',
    emailVerified: true,
    payload: { uid: 'userA', createdAt: '2020-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Oversized name injection (>24 chars)',
    path: '/players/userA',
    operation: 'create',
    authUid: 'userA',
    emailVerified: true,
    payload: { uid: 'userA', name: 'A_Very_Long_Name_Exceeding_Max_Length_Limit' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'ID poisoning in party path',
    path: '/parties/invalid$id!',
    operation: 'create',
    authUid: 'userA',
    emailVerified: true,
    payload: { id: 'invalid$id!', leaderUid: 'userA' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Cross-user update on public profile',
    path: '/publicProfiles/userB',
    operation: 'update',
    authUid: 'userA',
    emailVerified: true,
    payload: { level: 9999 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Chat message impersonation',
    path: '/chatMessages/msg1',
    operation: 'create',
    authUid: 'userA',
    emailVerified: true,
    payload: { uid: 'userB', senderName: 'Goku', channel: 'global', text: 'Hi' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Chat message mutation tampering',
    path: '/chatMessages/msg1',
    operation: 'update',
    authUid: 'userA',
    emailVerified: true,
    payload: { text: 'Edited' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unbounded inventory flooding (>120 items)',
    path: '/players/userA',
    operation: 'update',
    authUid: 'userA',
    emailVerified: true,
    payload: { inventory: new Array(150).fill({ id: 'x' }) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unverified email user write attempt',
    path: '/chatMessages/msg2',
    operation: 'create',
    authUid: 'userA',
    emailVerified: false,
    payload: { uid: 'userA', text: 'spam' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
