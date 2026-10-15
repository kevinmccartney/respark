import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';

import { fetchCostSummary } from '../api/costs';

export const costKeys = {
  all: ['costs'] as const,
  summary: () => [...costKeys.all, 'summary'] as const,
};

export const useCostSummary = () => {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: costKeys.summary(),
    queryFn: ({ signal }) => fetchCostSummary(getToken, { signal }),
    // The API caches Cost Explorer for hours; refetching sooner gains nothing.
    staleTime: 60 * 60 * 1000,
  });
};
