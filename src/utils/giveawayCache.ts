import NodeCache from "node-cache";

// ✅ Create a cache with expiration (1 hour TTL, check every 2 minutes)
export const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });