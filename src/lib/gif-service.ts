export interface GifItem {
  id: string;
  previewUrl: string;
  mp4Url: string;
  title: string;
  width: number;
  height: number;
  aspectRatio: number;
}

const FALLBACK_GIFS: GifItem[] = [
  {
    id: 'fb-1',
    title: 'Happy Dance',
    previewUrl: 'https://media.giphy.com/media/l0HlHFRbmaZtBRhXG/giphy.gif',
    mp4Url: 'https://media.giphy.com/media/l0HlHFRbmaZtBRhXG/giphy.mp4',
    width: 480,
    height: 480,
    aspectRatio: 1.0,
  },
  {
    id: 'fb-2',
    title: 'Mind Blown',
    previewUrl: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    mp4Url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.mp4',
    width: 480,
    height: 270,
    aspectRatio: 1.77,
  },
  {
    id: 'fb-3',
    title: 'Vibe Check',
    previewUrl: 'https://media.giphy.com/media/3o7TKsjN42gScwN9Qs/giphy.gif',
    mp4Url: 'https://media.giphy.com/media/3o7TKsjN42gScwN9Qs/giphy.mp4',
    width: 480,
    height: 360,
    aspectRatio: 1.33,
  },
  {
    id: 'fb-4',
    title: 'Thumbs Up',
    previewUrl: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    mp4Url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.mp4',
    width: 400,
    height: 225,
    aspectRatio: 1.77,
  },
  {
    id: 'fb-5',
    title: 'Cat Wave',
    previewUrl: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
    mp4Url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.mp4',
    width: 400,
    height: 300,
    aspectRatio: 1.33,
  },
  {
    id: 'fb-6',
    title: 'Celebration',
    previewUrl: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif',
    mp4Url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.mp4',
    width: 500,
    height: 281,
    aspectRatio: 1.78,
  },
];

function getProviderAndKey(): { provider: 'giphy' | 'tenor'; apiKey: string } | null {
  const gifKey = process.env.GIF_API_KEY;
  const giphyKey = process.env.GIPHY_API_KEY;
  const tenorKey = process.env.TENOR_API_KEY || process.env.NEXT_PUBLIC_TENOR_API_KEY;

  if (giphyKey) return { provider: 'giphy', apiKey: giphyKey };
  if (gifKey) {
    const provider = gifKey.startsWith('AIza') ? 'tenor' : 'giphy';
    return { provider, apiKey: gifKey };
  }
  if (tenorKey) return { provider: 'tenor', apiKey: tenorKey };
  return null;
}

export async function fetchTrendingGifsServer(page: number = 1, limit: number = 20): Promise<GifItem[]> {
  const config = getProviderAndKey();

  if (!config) {
    return FALLBACK_GIFS;
  }

  try {
    if (config.provider === 'giphy') {
      const offset = (page - 1) * limit;
      const url = `https://api.giphy.com/v1/gifs/trending?api_key=${config.apiKey}&limit=${limit}&offset=${offset}`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (!res.ok) throw new Error(`Giphy status ${res.status}`);
      const data = await res.json();
      return parseGiphyResults(data.data);
    } else {
      // Tenor API v2
      const url = `https://tenor.googleapis.com/v2/featured?key=${config.apiKey}&limit=${limit}&media_filter=tinymp4,mp4,tinygif,gif`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (!res.ok) throw new Error(`Tenor status ${res.status}`);
      const data = await res.json();
      return parseTenorResults(data.results);
    }
  } catch (error) {
    console.error('Error fetching trending GIFs server-side:', error);
    return FALLBACK_GIFS;
  }
}

export async function searchGifsServer(query: string, page: number = 1, limit: number = 20): Promise<GifItem[]> {
  const config = getProviderAndKey();

  if (!query.trim() || !config) {
    return fetchTrendingGifsServer(page, limit);
  }

  try {
    if (config.provider === 'giphy') {
      const offset = (page - 1) * limit;
      const url = `https://api.giphy.com/v1/gifs/search?api_key=${config.apiKey}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (!res.ok) throw new Error(`Giphy status ${res.status}`);
      const data = await res.json();
      return parseGiphyResults(data.data);
    } else {
      // Tenor API v2
      const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${config.apiKey}&limit=${limit}&media_filter=tinymp4,mp4,tinygif,gif`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (!res.ok) throw new Error(`Tenor status ${res.status}`);
      const data = await res.json();
      return parseTenorResults(data.results);
    }
  } catch (error) {
    console.error('Error searching GIFs server-side:', error);
    return FALLBACK_GIFS.filter((g) => g.title.toLowerCase().includes(query.toLowerCase()));
  }
}

function parseTenorResults(results: any[]): GifItem[] {
  if (!Array.isArray(results)) return [];
  return results
    .map((item: any) => {
      const formats = item.media_formats || {};
      const mp4Obj = formats.mp4 || formats.tinymp4;
      const gifObj = formats.tinygif || formats.gif;

      const mp4Url = mp4Obj?.url || gifObj?.url || '';
      const previewUrl = formats.tinymp4?.url || gifObj?.url || mp4Url;

      const width = mp4Obj?.dims?.[0] || gifObj?.dims?.[0] || 200;
      const height = mp4Obj?.dims?.[1] || gifObj?.dims?.[1] || 200;
      const aspectRatio = height > 0 ? Number((width / height).toFixed(2)) : 1;

      return {
        id: String(item.id),
        previewUrl,
        mp4Url,
        title: item.title || item.content_description || 'GIF',
        width,
        height,
        aspectRatio,
      };
    })
    .filter((item) => Boolean(item.mp4Url || item.previewUrl));
}

function parseGiphyResults(results: any[]): GifItem[] {
  if (!Array.isArray(results)) return [];
  return results
    .map((item: any) => {
      const images = item.images || {};
      const mp4Url = images.original_mp4?.mp4 || images.fixed_height?.mp4 || images.downsized_small?.mp4 || images.fixed_height?.url || '';
      const previewUrl = images.fixed_height_small?.url || images.preview_gif?.url || images.fixed_height?.url || mp4Url;

      const width = Number(images.original_mp4?.width || images.fixed_height?.width || 200);
      const height = Number(images.original_mp4?.height || images.fixed_height?.height || 200);
      const aspectRatio = height > 0 ? Number((width / height).toFixed(2)) : 1;

      return {
        id: String(item.id),
        previewUrl,
        mp4Url,
        title: item.title || 'GIF',
        width,
        height,
        aspectRatio,
      };
    })
    .filter((item) => Boolean(item.mp4Url || item.previewUrl));
}
