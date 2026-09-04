const SECOND = 1_000;
const MINUTE = 60 * SECOND;

export const cachePolicy = {
  static: {
    staleTime: 30 * MINUTE,
    gcTime: 60 * MINUTE,
  },

  roster: {
    staleTime: 5 * MINUTE,
    gcTime: 30 * MINUTE,
  },

  history: {
    staleTime: 2 * MINUTE,
    gcTime: 15 * MINUTE,
  },

  transfers: {
    staleTime: 30 * SECOND,
    gcTime: 10 * MINUTE,
  },

  live: {
    staleTime: 0,
    gcTime: 2 * MINUTE,
  },
};

export default cachePolicy;
