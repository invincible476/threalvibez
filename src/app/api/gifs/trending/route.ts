import { NextRequest, NextResponse } from 'next/server';
import { fetchTrendingGifsServer } from '@/lib/gif-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const gifs = await fetchTrendingGifsServer(page, limit);

    return NextResponse.json(gifs, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error in /api/gifs/trending:', error);
    return NextResponse.json({ error: 'Failed to fetch trending GIFs' }, { status: 500 });
  }
}
