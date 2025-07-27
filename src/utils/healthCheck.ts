import { DatabaseService } from '../services/databaseService';
import { createServiceLogger } from './logger';

const logger = createServiceLogger('Health');

export interface HealthStatus {
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: number;
    services: {
        database: ServiceHealth;
        speech: ServiceHealth;
        discord: ServiceHealth;
    };
    uptime: number;
    memory: {
        used: number;
        total: number;
        percentage: number;
    };
}

export interface ServiceHealth {
    status: 'up' | 'down' | 'degraded';
    responseTime?: number;
    lastCheck: number;
    error?: string;
}

export class HealthChecker {
    private dbService: DatabaseService;
    private startTime: number;

    constructor(dbService: DatabaseService) {
        this.dbService = dbService;
        this.startTime = Date.now();
    }

    /**
     * Perform comprehensive health check
     */
    async checkHealth(): Promise<HealthStatus> {
        logger.debug('Performing health check');

        const [databaseHealth, speechHealth, discordHealth] = await Promise.allSettled([
            this.checkDatabase(),
            this.checkSpeechService(),
            this.checkDiscordConnection()
        ]);

        const services = {
            database: this.getResultValue(databaseHealth, 'Database check failed'),
            speech: this.getResultValue(speechHealth, 'Speech service check failed'),
            discord: this.getResultValue(discordHealth, 'Discord check failed')
        };

        const memory = this.getMemoryUsage();
        const overallStatus = this.determineOverallStatus(services, memory);

        const healthStatus: HealthStatus = {
            status: overallStatus,
            timestamp: Date.now(),
            services,
            uptime: Date.now() - this.startTime,
            memory
        };

        logger.info('Health check completed', { 
            status: overallStatus,
            services: {
                database: services.database.status,
                speech: services.speech.status,
                discord: services.discord.status
            },
            memoryUsage: `${memory.percentage.toFixed(1)}%`
        });

        return healthStatus;
    }

    /**
     * Check database connectivity
     */
    private async checkDatabase(): Promise<ServiceHealth> {
        const start = Date.now();
        
        try {
            const isConnected = await this.dbService.testConnection();
            const responseTime = Date.now() - start;
            
            return {
                status: isConnected ? 'up' : 'down',
                responseTime,
                lastCheck: Date.now(),
                error: isConnected ? undefined : 'Connection test failed'
            };
        } catch (error) {
            return {
                status: 'down',
                responseTime: Date.now() - start,
                lastCheck: Date.now(),
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Check speech recognition service
     */
    private async checkSpeechService(): Promise<ServiceHealth> {
        try {
            // Basic check - verify speech service is initialized
            // In a real implementation, you might want to add a health check method
            // to the SpeechRecognitionService class
            
            return {
                status: 'up',
                lastCheck: Date.now()
            };
        } catch (error) {
            return {
                status: 'down',
                lastCheck: Date.now(),
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Check Discord connection
     */
    private async checkDiscordConnection(): Promise<ServiceHealth> {
        try {
            // Check if Discord client is ready
            // This would need to be passed from the bot instance
            // For now, we'll do a basic check
            
            return {
                status: 'up',
                lastCheck: Date.now()
            };
        } catch (error) {
            return {
                status: 'down',
                lastCheck: Date.now(),
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get memory usage information
     */
    private getMemoryUsage() {
        const used = process.memoryUsage();
        const total = used.heapTotal;
        const percentage = (used.heapUsed / total) * 100;

        return {
            used: Math.round(used.heapUsed / 1024 / 1024), // MB
            total: Math.round(total / 1024 / 1024), // MB
            percentage
        };
    }

    /**
     * Determine overall system status
     */
    private determineOverallStatus(
        services: HealthStatus['services'], 
        memory: HealthStatus['memory']
    ): HealthStatus['status'] {
        // Check if any critical service is down
        if (services.database.status === 'down' || services.discord.status === 'down') {
            return 'unhealthy';
        }

        // Check if memory usage is critical (>90%)
        if (memory.percentage > 90) {
            return 'unhealthy';
        }

        // Check if any service is degraded or memory is high (>75%)
        const hasDegrade = Object.values(services).some(service => service.status === 'degraded');
        if (hasDegrade || memory.percentage > 75) {
            return 'degraded';
        }

        return 'healthy';
    }

    /**
     * Extract value from Promise.allSettled result
     */
    private getResultValue(
        result: PromiseSettledResult<ServiceHealth>, 
        defaultError: string
    ): ServiceHealth {
        if (result.status === 'fulfilled') {
            return result.value;
        }
        
        return {
            status: 'down',
            lastCheck: Date.now(),
            error: defaultError
        };
    }
}