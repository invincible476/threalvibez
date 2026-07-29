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
 */
export function matchesUserSearch(user: User, searchTerm: string, currentUserId?: string): boolean {
  if (!user) return false;
  if (currentUserId && (user.uid === currentUserId || user.id === currentUserId)) {
    return false;
  }

  const rawTerm = searchTerm.trim().toLowerCase();
  const cleanTerm = rawTerm.replace(/^@/, '');
  if (!cleanTerm) return false;

  const tokens = cleanTerm.split(/\s+/).filter(Boolean);

  const nameStr = (user.name || '').toLowerCase();
  const emailStr = (user.email || '').toLowerCase();
  const usernameStr = (user.username || '').toLowerCase();
  const emailPrefix = emailStr.split('@')[0] || '';

  // 1. Direct or partial substring match on full query
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
    usernameStr.includes(token)
  );
}

// Lightweight cache for remote search results to prevent duplicate network calls
const searchCache = new Map<string, User[]>();

/**
 * Fast, resilient user search.
 * Instant local matching + lightweight targeted Firestore remote search.
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
  const titleTerm = cleanTerm
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  const map = new Map<string, User>();

  // 1. Add matching users from local pool immediately (0ms)
  knownUsersPool.forEach(u => {
    const normalized = normalizeUser(u);
    if (matchesUserSearch(normalized, cleanTerm, currentUserId)) {
      map.set(normalized.uid, normalized);
    }
  });

  // 2. Check search cache
  if (searchCache.has(lowerTerm)) {
    const cached = searchCache.get(lowerTerm) || [];
    cached.forEach(u => {
      if (matchesUserSearch(u, cleanTerm, currentUserId)) {
        map.set(u.uid, u);
      }
    });
    return Array.from(map.values());
  }

  // 3. Fast targeted Firestore queries with 1500ms timeout
  try {
    const usersRef = collection(db, 'users');

    const targetedQueries = [
      getDocs(query(usersRef, where('email', '==', lowerTerm), limit(15))),
      getDocs(query(usersRef, where('username', '==', lowerTerm), limit(15))),
      getDocs(query(usersRef, where('name', '==', cleanTerm), limit(15))),
      getDocs(query(usersRef, where('email', '>=', lowerTerm), where('email', '<=', lowerTerm + '\uf8ff'), limit(25))),
      getDocs(query(usersRef, where('name', '>=', titleTerm), where('name', '<=', titleTerm + '\uf8ff'), limit(25))),
      getDocs(query(usersRef, where('name', '>=', lowerTerm), where('name', '<=', lowerTerm + '\uf8ff'), limit(25))),
    ];

    const fetchPromise = Promise.allSettled(targetedQueries);
    const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 1500));

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

  const merged = Array.from(map.values());

  return merged.sort((a, b) => {
    const aEmail = (a.email || '').toLowerCase();
    const bEmail = (b.email || '').toLowerCase();
    const aUser = (a.username || '').toLowerCase();
    const bUser = (b.username || '').toLowerCase();
    const aName = (a.name || '').toLowerCase();
    const bName = (b.name || '').toLowerCase();

    if (aEmail === lowerTerm && bEmail !== lowerTerm) return -1;
    if (bEmail === lowerTerm && aEmail !== lowerTerm) return 1;

    if (aUser === lowerTerm && bUser !== lowerTerm) return -1;
    if (bUser === lowerTerm && aUser !== lowerTerm) return 1;

    const aStartsWith = aName.startsWith(lowerTerm) || aEmail.startsWith(lowerTerm) || aUser.startsWith(lowerTerm);
    const bStartsWith = bName.startsWith(lowerTerm) || bEmail.startsWith(lowerTerm) || bUser.startsWith(lowerTerm);
    if (aStartsWith && !bStartsWith) return -1;
    if (bStartsWith && !aStartsWith) return 1;

    return aName.localeCompare(bName);
  });
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
