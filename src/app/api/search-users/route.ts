import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizeUser, matchesUserSearch, sortSearchResults } from '@/lib/user-service';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    const currentUserId = url.searchParams.get('currentUserId') || undefined;

    const cleanTerm = q.trim().toLowerCase().replace(/^@/, '');
    if (!cleanTerm) {
      return NextResponse.json({ success: true, users: [] });
    }

    const usersRef = collection(db, 'users');
    const normalizedTerm = cleanTerm.toLowerCase();
    const titleTerm = cleanTerm
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    const map = new Map<string, any>();

    // 1. Fetch snapshot of users from Firestore server-side (0ms permission restrictions on server)
    try {
      const snap = await getDocs(query(usersRef, limit(500)));
      snap.docs.forEach((docSnap) => {
        const norm = normalizeUser(docSnap.data(), docSnap.id);
        if (matchesUserSearch(norm, cleanTerm, currentUserId)) {
          map.set(norm.uid, norm);
        }
      });
    } catch (snapErr) {
      console.warn('[API Search Users] Server snapshot notice:', snapErr);
    }

    // 2. Targeted queries fallback if snapshot returned no matches
    if (map.size === 0) {
      const targetedQueries = [
        getDocs(query(usersRef, where('email', '==', normalizedTerm), limit(20))),
        getDocs(query(usersRef, where('username', '==', normalizedTerm), limit(20))),
        getDocs(query(usersRef, where('name', '==', cleanTerm), limit(20))),
        getDocs(query(usersRef, where('displayName', '==', cleanTerm), limit(20))),
        getDocs(query(usersRef, where('name', '>=', titleTerm), where('name', '<=', titleTerm + '\uf8ff'), limit(20))),
        getDocs(query(usersRef, where('name', '>=', normalizedTerm), where('name', '<=', normalizedTerm + '\uf8ff'), limit(20))),
      ];

      const results = await Promise.allSettled(targetedQueries);
      results.forEach((res) => {
        if (res.status === 'fulfilled' && res.value) {
          res.value.docs.forEach((docSnap) => {
            const norm = normalizeUser(docSnap.data(), docSnap.id);
            if (matchesUserSearch(norm, cleanTerm, currentUserId)) {
              map.set(norm.uid, norm);
            }
          });
        }
      });
    }

    const finalResults = sortSearchResults(Array.from(map.values()), cleanTerm);
    const duration = Date.now() - startTime;
    console.log(`[API Search Users] Query: "${cleanTerm}" -> Found: ${finalResults.length} matches in ${duration}ms`);

    return NextResponse.json({
      success: true,
      users: finalResults,
    });
  } catch (error: any) {
    console.error('[API Search Users] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to search users' },
      { status: 500 }
    );
  }
}
