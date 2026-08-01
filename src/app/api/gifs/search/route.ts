import { NextRequest, NextResponse } from 'next/server';
import { searchGifsServer } from '@/lib/gif-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const gifs = await searchGifsServer(q, page, limit);

    return NextResponse.json(gifs, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error in /api/gifs/search:', error);
    return NextResponse.json({ error: 'Failed to search GIFs' }, { status: 500 });
  }
}
