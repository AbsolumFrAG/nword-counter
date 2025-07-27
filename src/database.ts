import * as dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

export interface UserRanking {
    user_id: string;
    guild_id: string;
    count: number;
    last_detection: Date;
    created_at: Date;
    updated_at: Date;
}

export class DatabaseService {
    private pool: Pool;

    constructor() {
        this.pool = new Pool({
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'nword_counter',
            password: process.env.DB_PASSWORD || 'password',
            port: parseInt(process.env.DB_PORT || '5432'),
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        });

        // Handle pool errors
        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
        });
    }

    /**
     * Initialize the database by creating necessary tables
     */
    async initialize(): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Create rankings table
            await client.query(`
                CREATE TABLE IF NOT EXISTS rankings (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    count INTEGER DEFAULT 0,
                    last_detection TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE(user_id, guild_id)
                )
            `);

            // Create index for faster queries
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_rankings_guild_count 
                ON rankings (guild_id, count DESC)
            `);

            // Create index for user/guild lookup
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_rankings_user_guild 
                ON rankings (user_id, guild_id)
            `);

            await client.query('COMMIT');
            console.log('Database tables initialized successfully');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error initializing database:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Increment word count for a user in a specific guild
     */
    async incrementWordCount(userId: string, guildId: string): Promise<number> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                INSERT INTO rankings (user_id, guild_id, count, last_detection, updated_at)
                VALUES ($1, $2, 1, NOW(), NOW())
                ON CONFLICT (user_id, guild_id)
                DO UPDATE SET 
                    count = rankings.count + 1,
                    last_detection = NOW(),
                    updated_at = NOW()
                RETURNING count
            `, [userId, guildId]);

            return result.rows[0].count;
        } catch (error) {
            console.error('Error incrementing word count:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get user's current count in a specific guild
     */
    async getUserCount(userId: string, guildId: string): Promise<number> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT count FROM rankings 
                WHERE user_id = $1 AND guild_id = $2
            `, [userId, guildId]);

            return result.rows.length > 0 ? result.rows[0].count : 0;
        } catch (error) {
            console.error('Error getting user count:', error);
            return 0;
        } finally {
            client.release();
        }
    }

    /**
     * Get leaderboard for a specific guild
     */
    async getLeaderboard(guildId: string, limit: number = 10): Promise<UserRanking[]> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT user_id, guild_id, count, last_detection, created_at, updated_at
                FROM rankings 
                WHERE guild_id = $1 AND count > 0
                ORDER BY count DESC, last_detection ASC
                LIMIT $2
            `, [guildId, limit]);

            return result.rows;
        } catch (error) {
            console.error('Error getting leaderboard:', error);
            return [];
        } finally {
            client.release();
        }
    }

    /**
     * Get statistics for a guild
     */
    async getGuildStats(guildId: string): Promise<{
        totalDetections: number;
        uniqueUsers: number;
        topUser: string | null;
        averagePerUser: number;
    }> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    SUM(count) as total_detections,
                    COUNT(DISTINCT user_id) as unique_users,
                    (SELECT user_id FROM rankings WHERE guild_id = $1 ORDER BY count DESC LIMIT 1) as top_user,
                    COALESCE(AVG(count), 0) as average_per_user
                FROM rankings 
                WHERE guild_id = $1 AND count > 0
            `, [guildId]);

            const row = result.rows[0];
            return {
                totalDetections: parseInt(row.total_detections) || 0,
                uniqueUsers: parseInt(row.unique_users) || 0,
                topUser: row.top_user,
                averagePerUser: parseFloat(row.average_per_user) || 0
            };
        } catch (error) {
            console.error('Error getting guild stats:', error);
            return {
                totalDetections: 0,
                uniqueUsers: 0,
                topUser: null,
                averagePerUser: 0
            };
        } finally {
            client.release();
        }
    }

    /**
     * Reset user's count in a specific guild
     */
    async resetUserCount(userId: string, guildId: string): Promise<boolean> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                UPDATE rankings 
                SET count = 0, updated_at = NOW()
                WHERE user_id = $1 AND guild_id = $2
            `, [userId, guildId]);

            return (result.rowCount ?? 0) > 0;
        } catch (error) {
            console.error('Error resetting user count:', error);
            return false;
        } finally {
            client.release();
        }
    }

    /**
     * Reset all counts in a specific guild
     */
    async resetGuildCounts(guildId: string): Promise<number> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                UPDATE rankings 
                SET count = 0, updated_at = NOW()
                WHERE guild_id = $1
            `, [guildId]);

            return result.rowCount || 0;
        } catch (error) {
            console.error('Error resetting guild counts:', error);
            return 0;
        } finally {
            client.release();
        }
    }

    /**
     * Close the database connection pool
     */
    async close(): Promise<void> {
        await this.pool.end();
    }

    /**
     * Test database connection
     */
    async testConnection(): Promise<boolean> {
        try {
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            return true;
        } catch (error) {
            console.error('Database connection test failed:', error);
            return false;
        }
    }
}