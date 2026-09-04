import { QueryClient } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,

      retry: 1,

      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },

    mutations: {
      retry: 0,
    },
  },
});

export default queryClient;
