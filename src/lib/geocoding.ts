// Cache for geocoding results
const geocodingCache = new Map<string, { city: string | null; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

export async function getCityFromCoords(latitude: number, longitude: number): Promise<string | null> {
    const cacheKey = `${latitude},${longitude}`;
    const now = Date.now();
    
    // Check cache first
    const cached = geocodingCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        return cached.city;
    }
    
    // Rate limiting
    const timeUntilNextRequest = lastRequestTime + MIN_REQUEST_INTERVAL - now;
    if (timeUntilNextRequest > 0) {
        await new Promise(resolve => setTimeout(resolve, timeUntilNextRequest));
    }
    
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < maxRetries) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                {
                    headers: {
                        'User-Agent': 'Vibez Chat App (https://vibez.chat)',
                        'Accept-Language': 'en',
                        'Accept': 'application/json',
                        'Referer': 'https://vibez.chat'
                    },
                    cache: 'no-store', // Don't use force-cache as it can cause issues
                    signal: controller.signal,
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const city = data.address?.city || data.address?.town || data.address?.village || null;

            // Update cache and last request time
            geocodingCache.set(cacheKey, { city, timestamp: now });
            lastRequestTime = now;

            return city;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.error(`Attempt ${retryCount + 1} failed:`, lastError);

            if (error instanceof Error && error.name === 'AbortError') {
                console.error('Request timed out');
                break; // Don't retry on timeout
            }

            retryCount++;
            if (retryCount < maxRetries) {
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
            }
        } finally {
            clearTimeout(timeoutId);
        }
    }

    console.error(`All ${maxRetries} attempts failed:`, lastError);
    return null;
}