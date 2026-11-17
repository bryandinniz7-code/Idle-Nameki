# Security Specification — Idle Nameki

## 1. Data Invariants
1. A `players/{uid}` document can only be read, created, or updated by the authenticated, email-verified user whose `request.auth.uid == uid`, and `incoming().uid == uid` is immutable.
2. `publicProfiles/{uid}` contains zero PII (no email, phone, or private tokens), always sets `isPublic == true`, and can only be written by `request.auth.uid == uid`.
3. `parties/{partyId}` can only be created by an authenticated user setting `leaderUid == request.auth.uid`, and `leaderUid` + `createdAt` are immutable.
4. `parties/{partyId}/members/{memberUid}` enforces Master Gate: parent `parties/{partyId}` must exist, and a user can only join (`create`) as themselves (`memberUid == request.auth.uid`) or leave (`delete`) themselves or be removed by the party leader.
5. `chatMessages/{messageId}` can only be created by `request.auth.uid == incoming().uid` with `channel == 'global'`, `text` bounded 1..240 chars, and server `createdAt == request.time`. Messages are immutable (`update` and `delete` denied).
6. `afkHistory/{historyId}` can only be read (`get`/`list`) and created by the owner `uid == request.auth.uid`, with server `claimedAt == request.time`. History records are immutable.
7. `worldPresence/{uid}` stores only non-PII live coordinates, map, flight, pet, fusion, guildTag, and emotes; only the verified owner (`request.auth.uid == uid`) may create, update, or delete their document, while signed-in players may list only documents where `isOnline == true`.
8. `gameConfig/global` can only be read (`get`) by signed-in users (`list` denied), and can only be created or updated by the verified bootstrapped admin (`bryandinniz7@gmail.com`) or an admin UID listed in `adminUids`.
9. `guilds/{guildId}` can only be created by `leaderUid == request.auth.uid`; members (`guilds/{guildId}/members/{memberUid}`) and guild chat (`guilds/{guildId}/chat/{messageId}`) enforce Master Gate on parent guild membership, and only members can read/send guild chat.
10. `marketListings/{listingId}` enforces seller ownership (`sellerUid == request.auth.uid`) on create/delete; purchases (`status: 'open' -> 'sold'`) require an authenticated buyer distinct from the seller while keeping `item`, `price`, `sellerUid`, and `createdAt` strictly immutable.
11. `worldBosses/active` allows verified signed-in players to collaboratively update shared boss HP, damage leaderboard, and respawn cycle without allowing arbitrary document creation outside `'active'`.

## 2. Dirty Dozen Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated read of `/players/userA`**: `auth: null` -> DENIED.
2. **Cross-user read of `/players/userB` by `userA`**: `uid != auth.uid` -> DENIED.
3. **Ghost field injection on `/players/userA` create** (e.g., `isAdmin: true`): blocked by `keys().hasOnly(...)` -> DENIED.
4. **UID spoofing on `/publicProfiles/userA` create** (`uid: "userB"`): blocked by `incoming().uid == request.auth.uid` -> DENIED.
5. **Client timestamp forgery on `/players/userA`** (`createdAt` != `request.time`): blocked by temporal integrity check -> DENIED.
6. **Oversized string injection on `/players/userA`** (`name` > 24 chars or `uid` > 128 chars): blocked by `.size()` bounds -> DENIED.
7. **ID poisoning with invalid characters** (`/parties/../../hack`): blocked by `isValidId()` -> DENIED.
8. **Cross-user update on `/publicProfiles/userB` by `userA`**: blocked by `isOwner(uid)` -> DENIED.
9. **Chat message impersonation** (`/chatMessages/msg1` with `uid: "otherUser"`): blocked by `incoming().uid == request.auth.uid` -> DENIED.
10. **Market price tampering during purchase** (buyer changing `price` from 5000 to 1): blocked by `incoming().price == existing().price && incoming().item == existing().item` -> DENIED.
11. **Non-member reading private Guild chat** (`/guilds/g1/chat`): blocked by `exists(/guilds/g1/members/$(request.auth.uid))` -> DENIED.
12. **List query scraping on `/afkHistory` without `uid == auth.uid` filter**: blocked by `resource.data.uid == request.auth.uid` -> DENIED.
