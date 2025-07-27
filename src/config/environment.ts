import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('Config');

export interface Environment {
    DISCORD_BOT_TOKEN: string;
    DB_HOST: string;
    DB_PORT: number;
    DB_NAME: string;
    DB_USER: string;
    DB_PASSWORD: string;
    DB_SSL: boolean;
    NODE_ENV: 'development' | 'production' | 'test';
    LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
    DB_POOL_MIN: number;
    DB_POOL_MAX: number;
    COMMAND_COOLDOWN_MS: number;
}

export const validateEnvironment = (): Environment => {
    const requiredVars = ['DISCORD_BOT_TOKEN', 'DB_PASSWORD'];
    
    for (const varName of requiredVars) {
        if (!process.env[varName]) {
            logger.error(`Missing required environment variable: ${varName}`);
            process.exit(1);
        }
    }

    return {
        DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN!,
        DB_HOST: process.env.DB_HOST || 'localhost',
        DB_PORT: parseInt(process.env.DB_PORT || '5432'),
        DB_NAME: process.env.DB_NAME || 'nword_counter',
        DB_USER: process.env.DB_USER || 'postgres',
        DB_PASSWORD: process.env.DB_PASSWORD!,
        DB_SSL: process.env.DB_SSL === 'true',
        NODE_ENV: (process.env.NODE_ENV as any) || 'development',
        LOG_LEVEL: (process.env.LOG_LEVEL as any) || 'info',
        DB_POOL_MIN: parseInt(process.env.DB_POOL_MIN || '2'),
        DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || '10'),
        COMMAND_COOLDOWN_MS: parseInt(process.env.COMMAND_COOLDOWN_MS || '3000')
    };
};

export const config = validateEnvironment();