import { collection, doc, getDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/lib/types';

/**
 * Normalizes any raw user object or Firestore document data into a complete User object.
 */
export function normalizeUser(data: any, docId?: string): User {
  if (!data) {
    const id = docId || '';
    return {
      id,
      uid: id,
      name: 'Unknown User',
      username: '',
      email: '',
      photoURL: null,
      status: 'offline',
      friends: [],
      friendRequestsSent: [],
      friendRequestsReceived: [],
      blockedUsers: [],
    };
  }

  const targetId = data.uid || data.id || docId || '';

  const name =
    data.name ||
    data.displayName ||
    data.fullName ||
    (data.email ? data.email.split('@')[0] : 'User');

  const username = data.username || data.handle || '';
  const email = data.email || '';
  const photoURL = data.photoURL || data.avatar || null;
  const status = data.status === 'online' ? 'online' : 'offline';

  return {
    ...data,
    id: targetId,
    uid: targetId,
    name,
    username,
    email,
    photoURL,
    status,
    friends: Array.isArray(data.friends) ? data.friends : [],
    friendRequestsSent: Array.isArray(data.friendRequestsSent) ? data.friendRequestsSent : [],
    friendRequestsReceived: Array.isArray(data.friendRequestsReceived) ? data.friendRequestsReceived : [],
    blockedUsers: Array.isArray(data.blockedUsers) ? data.blockedUsers : [],
  };
}

/**
 * Client-side matcher for user search query.
 * Smart prefix matching for single letters + tokenized substring matching for longer queries.
 */
export function matchesUserSearch(user: User, searchTerm: string, currentUserId?: string): boolean {
  if (!user) return false;
  
  const targetUid = user.uid || user.id;
  if (currentUserId && (targetUid === currentUserId)) {
    return false;
  }

  const rawTerm = searchTerm.trim().toLowerCase();
  const cleanTerm = rawTerm.replace(/^@/, '');
  if (!cleanTerm) return false;

  const nameStr = (user.name || '').toLowerCase();
  const emailStr = (user.email || '').toLowerCase();
  const usernameStr = (user.username || '').toLowerCase();
  const emailPrefix = emailStr.split('@')[0] || '';
  const nameWords = nameStr.split(/\s+/).filter(Boolean);

  // For 1-character queries (e.g. 'm'), ONLY match if name, email, or username STARTS with 'm'
  if (cleanTerm.length === 1) {
    const startsWithChar =
      nameStr.startsWith(cleanTerm) ||
      emailStr.startsWith(cleanTerm) ||
      usernameStr.startsWith(cleanTerm) ||
      emailPrefix.startsWith(cleanTerm) ||
      nameWords.some(w => w.startsWith(cleanTerm));

    return startsWithChar;
  }

  const tokens = cleanTerm.split(/\s+/).filter(Boolean);

  // 1. Direct substring match on full clean query
  const directMatch =
    nameStr.includes(cleanTerm) ||
    emailStr.includes(cleanTerm) ||
    usernameStr.includes(cleanTerm) ||
    emailPrefix.includes(cleanTerm);

  if (directMatch) return true;

  // 2. Tokenized match (all search tokens must match at least one field)
  return tokens.every(token =>
    nameStr.includes(token) ||
    emailStr.includes(token) ||
    usernameStr.includes(token) ||
    emailPrefix.includes(token)
  );
}

/**
 * Ranks search results by relevance so prefix & exact matches appear at the top.
 */
export function sortSearchResults(users: User[], searchTerm: string): User[] {
  const cleanTerm = searchTerm.trim().toLowerCase().replace(/^@/, '');
  if (!cleanTerm) return users;

  return [...users].sort((a, b) => {
    const aName = (a.name || '').toLowerCase();
    const bName = (b.name || '').toLowerCase();
    const aEmail = (a.email || '').toLowerCase();
    const bEmail = (b.email || '').toLowerCase();
    const aUser = (a.username || '').toLowerCase();
    const bUser = (b.username || '').toLowerCase();

    // 1. Exact email match
    if (aEmail === cleanTerm && bEmail !== cleanTerm) return -1;
    if (bEmail === cleanTerm && aEmail !== cleanTerm) return 1;

    // 2. Exact username / name match
    if (aUser === cleanTerm && bUser !== cleanTerm) return -1;
    if (bUser === cleanTerm && aUser !== cleanTerm) return 1;
    if (aName === cleanTerm && bName !== cleanTerm) return -1;
    if (bName === cleanTerm && aName !== cleanTerm) return 1;

    // 3. Name/Email/Username Starts With cleanTerm
    const aStarts = aName.startsWith(cleanTerm) || aEmail.startsWith(cleanTerm) || aUser.startsWith(cleanTerm);
    const bStarts = bName.startsWith(cleanTerm) || bEmail.startsWith(cleanTerm) || bUser.startsWith(cleanTerm);
    if (aStarts && !bStarts) return -1;
    if (bStarts && !aStarts) return 1;

    // 4. Word in name starts with cleanTerm
    const aWordStarts = aName.split(/\s+/).some(w => w.startsWith(cleanTerm));
    const bWordStarts = bName.split(/\s+/).some(w => w.startsWith(cleanTerm));
    if (aWordStarts && !bWordStarts) return -1;
    if (bWordStarts && !aWordStarts) return 1;

    return aName.localeCompare(bName);
  });
}

// In-memory search cache for remote queries
const searchCache = new Map<string, User[]>();

/**
 * Fast, resilient user search engine.
 * Instant local matching + lightweight targeted Firestore fallback.
 */
export async function searchUsers(
  searchTerm: string,
  knownUsersPool: User[] = [],
  currentUserId?: string
): Promise<User[]> {
  const rawTerm = searchTerm.trim();
  const cleanTerm = rawTerm.replace(/^@/, '');
  if (!cleanTerm) return [];

  const lowerTerm = cleanTerm.toLowerCase();
  const map = new Map<string, User>();

  // 1. Add matching users from local pool immediately (0ms)
  knownUsersPool.forEach(u => {
    const normalized = normalizeUser(u);
    if (matchesUserSearch(normalized, cleanTerm, currentUserId)) {
      map.set(normalized.uid, normalized);
    }
  });

  // 2. Check cache if local pool has no matches
  if (map.size === 0 && searchCache.has(lowerTerm)) {
    const cached = searchCache.get(lowerTerm) || [];
    cached.forEach(u => {
      if (matchesUserSearch(u, cleanTerm, currentUserId)) {
        map.set(u.uid, u);
      }
    });
    return sortSearchResults(Array.from(map.values()), cleanTerm);
  }

  // 3. Targeted Firestore query fallback with 1000ms timeout guard
  try {
    const usersRef = collection(db, 'users');
    const titleTerm = cleanTerm
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    const targetedQueries = [
      getDocs(query(usersRef, where('email', '==', lowerTerm), limit(10))),
      getDocs(query(usersRef, where('username', '==', lowerTerm), limit(10))),
      getDocs(query(usersRef, where('name', '==', cleanTerm), limit(10))),
      getDocs(query(usersRef, where('displayName', '==', cleanTerm), limit(10))),
      getDocs(query(usersRef, where('email', '>=', lowerTerm), where('email', '<=', lowerTerm + '\uf8ff'), limit(15))),
      getDocs(query(usersRef, where('name', '>=', titleTerm), where('name', '<=', titleTerm + '\uf8ff'), limit(15))),
      getDocs(query(usersRef, where('name', '>=', lowerTerm), where('name', '<=', lowerTerm + '\uf8ff'), limit(15))),
      getDocs(query(usersRef, where('displayName', '>=', titleTerm), where('displayName', '<=', titleTerm + '\uf8ff'), limit(15))),
      getDocs(query(usersRef, where('displayName', '>=', lowerTerm), where('displayName', '<=', lowerTerm + '\uf8ff'), limit(15))),
    ];

    const fetchPromise = Promise.allSettled(targetedQueries);
    const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 1000));

    const result = await Promise.race([fetchPromise, timeoutPromise]);

    if (Array.isArray(result)) {
      const fetched: User[] = [];
      result.forEach(res => {
        if (res.status === 'fulfilled' && res.value) {
          res.value.docs.forEach(docSnap => {
            const normalized = normalizeUser(docSnap.data(), docSnap.id);
            fetched.push(normalized);
            if (matchesUserSearch(normalized, cleanTerm, currentUserId)) {
              map.set(normalized.uid, normalized);
            }
          });
        }
      });
      searchCache.set(lowerTerm, fetched);
    }
  } catch (err) {
    console.warn('Firestore targeted search notice:', err);
  }

  return sortSearchResults(Array.from(map.values()), cleanTerm);
}

/**
 * Fetches user documents directly by IDs for missing users.
 */
export async function fetchMissingUsers(
  userIds: string[],
  knownUsersPool: User[] = []
): Promise<User[]> {
  const existingIds = new Set(
    knownUsersPool
      .filter(Boolean)
      .map(u => u.uid || u.id)
      .filter(Boolean)
  );

  const missingIds = userIds.filter(id => id && !existingIds.has(id));
  if (missingIds.length === 0) return [];

  const fetched: User[] = [];

  const promises = missingIds.map(async id => {
    try {
      const docSnap = await getDoc(doc(db, 'users', id));
      if (docSnap.exists()) {
        return normalizeUser(docSnap.data(), docSnap.id);
      }
    } catch (e) {
      console.warn(`Error fetching user ${id}:`, e);
    }
    return null;
  });

  const results = await Promise.allSettled(promises);
  results.forEach(res => {
    if (res.status === 'fulfilled' && res.value) {
      fetched.push(res.value);
    }
  });

  return fetched;
}
