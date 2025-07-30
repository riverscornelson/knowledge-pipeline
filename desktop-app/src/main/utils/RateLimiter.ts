/**
 * Rate limiter for IPC requests
 */
export class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }>;
  private readonly limits: Map<string, { requests: number; windowMs: number }>;
  
  constructor() {
    this.requests = new Map();
    
    // Configure rate limits per channel
    this.limits = new Map([
      ['config:load', { requests: 10, windowMs: 60000 }], // 10 per minute
      ['config:save', { requests: 5, windowMs: 60000 }],  // 5 per minute
      ['config:test', { requests: 20, windowMs: 60000 }], // 20 per minute
      ['pipeline:start', { requests: 3, windowMs: 60000 }], // 3 per minute
      ['pipeline:stop', { requests: 3, windowMs: 60000 }],  // 3 per minute
      ['pipeline:status', { requests: 60, windowMs: 60000 }], // 60 per minute
      ['default', { requests: 30, windowMs: 60000 }] // Default: 30 per minute
    ]);
  }
  
  /**
   * Check if request is within rate limit
   */
  checkLimit(clientId: string, channel: string): boolean {
    const key = `${clientId}:${channel}`;
    const now = Date.now();
    
    // Get limit for channel
    const limit = this.limits.get(channel) || this.limits.get('default')!;
    
    // Get or create request record
    const record = this.requests.get(key);
    
    if (!record || now > record.resetTime) {
      // New window
      this.requests.set(key, {
        count: 1,
        resetTime: now + limit.windowMs
      });
      return true;
    }
    
    // Check if within limit
    if (record.count >= limit.requests) {
      return false;
    }
    
    // Increment count
    record.count++;
    return true;
  }
  
  /**
   * Reset limits for a client
   */
  resetClient(clientId: string): void {
    // Remove all entries for this client
    for (const key of this.requests.keys()) {
      if (key.startsWith(`${clientId}:`)) {
        this.requests.delete(key);
      }
    }
  }
  
  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requests.entries()) {
      if (now > record.resetTime) {
        this.requests.delete(key);
      }
    }
  }
  
  /**
   * Get current usage for monitoring
   */
  getUsage(clientId: string, channel: string): { count: number; remaining: number; resetTime: number } | null {
    const key = `${clientId}:${channel}`;
    const record = this.requests.get(key);
    
    if (!record) {
      return null;
    }
    
    const limit = this.limits.get(channel) || this.limits.get('default')!;
    
    return {
      count: record.count,
      remaining: Math.max(0, limit.requests - record.count),
      resetTime: record.resetTime
    };
  }
}