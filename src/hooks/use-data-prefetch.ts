import { 
  useQuery, 
  useMutation, 
  useQueryClient,
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryOptions as TanstackInfiniteQueryOptions
} from '@tanstack/react-query';
import { useCallback } from 'react';

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string | number;
  hasMore: boolean;
}

export interface UseInfiniteQueryOptions {
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  prefetchLimit?: number;
}

export function usePrefetch<T>(
  queryKey: string[],
  fetchFn: () => Promise<T>,
  options: UseInfiniteQueryOptions = {}
) {
  const queryClient = useQueryClient();
  const defaultOptions = {
    staleTime: 1000 * 60 * 15, // 15 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    cacheTime: 1000 * 60 * 30, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    ...options,
  };

  // Prefetch and cache the data
  const prefetch = useCallback(async () => {
    if (!queryClient.getQueryData(queryKey)) {
      await queryClient.prefetchQuery({
        queryKey,
        queryFn: fetchFn,
        staleTime: defaultOptions.staleTime,
        gcTime: defaultOptions.gcTime,
      });
    }
  }, [queryKey, fetchFn, defaultOptions.staleTime, defaultOptions.gcTime, queryClient]);

  return {
    prefetch,
  };
}

export function useOptimisticUpdate<T, U = unknown>(
  queryKey: string[],
  updateFn: (data: T) => Promise<U>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateFn,
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<T>(queryKey);

      // Optimistically update to the new value
      if (previousData) {
        queryClient.setQueryData<T>(queryKey, (old) => ({
          ...old,
          ...variables,
        }));
      }

      return { previousData };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data consistency
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useInfiniteScroll<T>(
  queryKey: string[],
  fetchFn: (pageParam: number) => Promise<PaginatedResponse<T>>,
  options: UseInfiniteQueryOptions = {}
) {
  const queryClient = useQueryClient();
  const defaultOptions = {
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    prefetchLimit: 1, // Number of pages to prefetch
    ...options,
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error
  } = useInfiniteQuery<PaginatedResponse<T>, Error, InfiniteData<PaginatedResponse<T>>, string[]>({
    queryKey,
    queryFn: async ({ pageParam }) => fetchFn(Number(pageParam)),
    initialPageParam: '1',
    getNextPageParam: (lastPage) => 
      lastPage.hasMore ? String(lastPage.nextCursor) : undefined,
    staleTime: defaultOptions.staleTime,
    gcTime: defaultOptions.gcTime,
    enabled: options.enabled !== false,
  });

  // Prefetch the next page
  const prefetchNextPage = useCallback(async () => {
    if (hasNextPage && data) {
      const lastPage = data.pages[data.pages.length - 1];
      await queryClient.prefetchInfiniteQuery({
        queryKey,
        queryFn: async ({ pageParam }) => fetchFn(Number(pageParam)),
        initialPageParam: '1',
        getNextPageParam: (lastPage: PaginatedResponse<T>) => 
          lastPage.hasMore ? String(lastPage.nextCursor) : undefined,
      });
    }
  }, [hasNextPage, data, queryKey, fetchFn, queryClient]);

  return {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    prefetchNextPage,
  };
}