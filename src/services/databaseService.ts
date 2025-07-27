// Re-export with better logging and configuration
import { config } from '../config/environment';
import { DatabaseService as OriginalDatabaseService, UserRanking } from '../database';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('Database');

export class DatabaseService extends OriginalDatabaseService {
    constructor() {
        // Use config values instead of direct env access
        const dbConfig = {
            user: config.DB_USER,
            host: config.DB_HOST,
            database: config.DB_NAME,
            password: config.DB_PASSWORD,
            port: config.DB_PORT,
            ssl: config.DB_SSL ? { rejectUnauthorized: false } : false,
            min: config.DB_POOL_MIN,
            max: config.DB_POOL_MAX,
        };

        super();
        logger.info('Database service created', { 
            host: dbConfig.host, 
            port: dbConfig.port, 
            database: dbConfig.database,
            ssl: dbConfig.ssl !== false,
            poolMin: dbConfig.min,
            poolMax: dbConfig.max
        });
    }

    async initialize(): Promise<void> {
        try {
            const connected = await this.testConnection();
            if (!connected) {
                throw new Error('Database connection test failed');
            }
            
            await super.initialize();
            logger.info('Database initialized successfully');
        } catch (error) {
            logger.error('Database initialization failed', { error });
            throw error;
        }
    }

    async incrementWordCount(userId: string, guildId: string): Promise<number> {
        try {
            const result = await super.incrementWordCount(userId, guildId);
            logger.debug('Word count incremented', { userId, guildId, newCount: result });
            return result;
        } catch (error) {
            logger.error('Failed to increment word count', { userId, guildId, error });
            throw error;
        }
    }

    async getLeaderboard(guildId: string, limit: number = 10): Promise<UserRanking[]> {
        try {
            const result = await super.getLeaderboard(guildId, limit);
            logger.debug('Leaderboard retrieved', { guildId, resultCount: result.length, limit });
            return result;
        } catch (error) {
            logger.error('Failed to get leaderboard', { guildId, limit, error });
            throw error;
        }
    }

    async getGuildStats(guildId: string): Promise<{
        totalDetections: number;
        uniqueUsers: number;
        topUser: string | null;
        averagePerUser: number;
    }> {
        try {
            const result = await super.getGuildStats(guildId);
            logger.debug('Guild stats retrieved', { guildId, stats: result });
            return result;
        } catch (error) {
            logger.error('Failed to get guild stats', { guildId, error });
            throw error;
        }
    }

    async resetUserCount(userId: string, guildId: string): Promise<boolean> {
        try {
            const result = await super.resetUserCount(userId, guildId);
            logger.info('User count reset', { userId, guildId, success: result });
            return result;
        } catch (error) {
            logger.error('Failed to reset user count', { userId, guildId, error });
            throw error;
        }
    }

    async resetGuildCounts(guildId: string): Promise<number> {
        try {
            const result = await super.resetGuildCounts(guildId);
            logger.info('Guild counts reset', { guildId, affectedRows: result });
            return result;
        } catch (error) {
            logger.error('Failed to reset guild counts', { guildId, error });
            throw error;
        }
    }
}

export { UserRanking };
