import { config } from '../config/environment';
import { createServiceLogger } from './logger';

const logger = createServiceLogger('RateLimit');

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

export class RateLimiter {
    private userLimits = new Map<string, RateLimitEntry>();
    private readonly cooldownMs: number;
    private readonly maxRequests: number;

    constructor(cooldownMs: number = config.COMMAND_COOLDOWN_MS, maxRequests: number = 1) {
        this.cooldownMs = cooldownMs;
        this.maxRequests = maxRequests;
        
        // Cleanup old entries every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
        
        logger.info('Rate limiter initialized', { cooldownMs, maxRequests });
    }

    /**
     * Check if user is rate limited
     */
    isRateLimited(userId: string): boolean {
        const now = Date.now();
        const userLimit = this.userLimits.get(userId);

        if (!userLimit) {
            // First request
            this.userLimits.set(userId, {
                count: 1,
                resetTime: now + this.cooldownMs
            });
            return false;
        }

        if (now >= userLimit.resetTime) {
            // Reset the limit
            userLimit.count = 1;
            userLimit.resetTime = now + this.cooldownMs;
            return false;
        }

        if (userLimit.count >= this.maxRequests) {
            logger.debug('User rate limited', { 
                userId, 
                count: userLimit.count, 
                resetIn: userLimit.resetTime - now 
            });
            return true;
        }

        userLimit.count++;
        return false;
    }

    /**
     * Get remaining cooldown time for user
     */
    getRemainingCooldown(userId: string): number {
        const userLimit = this.userLimits.get(userId);
        if (!userLimit) return 0;

        const remaining = userLimit.resetTime - Date.now();
        return Math.max(0, remaining);
    }

    /**
     * Clean up expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [userId, entry] of this.userLimits.entries()) {
            if (now >= entry.resetTime) {
                this.userLimits.delete(userId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.debug('Rate limiter cleanup completed', { cleaned, remaining: this.userLimits.size });
        }
    }
}

// Global rate limiter instance
export const globalRateLimiter = new RateLimiter();