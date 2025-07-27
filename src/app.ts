import 'dotenv/config';
import { DiscordBot } from './bot/client';
import { createServiceLogger } from './utils/logger';

const logger = createServiceLogger('App');

/**
 * Main application entry point
 */
async function main(): Promise<void> {
    logger.info('Starting Discord Bot Application', {
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV || 'development'
    });

    try {
        const bot = new DiscordBot();
        await bot.start();
    } catch (error) {
        logger.error('Failed to start application', { error });
        process.exit(1);
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
    process.exit(1);
});

// Start the application
main().catch((error) => {
    logger.error('Application startup failed', { error });
    process.exit(1);
});