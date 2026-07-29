import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizeUser, matchesUserSearch, sortSearchResults } from '@/lib/user-service';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    const currentUserId = url.searchParams.get('currentUserId') || undefined;

    const cleanTerm = q.trim().toLowerCase().replace(/^@/, '');
    if (!cleanTerm) {
      return NextResponse.json({ success: true, users: [] });
    }

    const map = new Map<string, any>();
    const usersRef = collection(db, 'users');

    // Fetch snapshot of users from Firestore server-side
    try {
      const snap = await getDocs(query(usersRef, limit(500)));
      snap.docs.forEach(docSnap => {
        const norm = normalizeUser(docSnap.data(), docSnap.id);
        if (matchesUserSearch(norm, cleanTerm, currentUserId)) {
          map.set(norm.uid, norm);
        }
      });
    } catch (fsErr) {
      console.warn('[API Search Users] Server snapshot notice:', fsErr);
    }

    const results = sortSearchResults(Array.from(map.values()), cleanTerm);

    return NextResponse.json({
      success: true,
      users: results,
    });
  } catch (error: any) {
    console.error('[API Search Users] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to search users' },
      { status: 500 }
    );
  }
}
