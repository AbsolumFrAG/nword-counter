// Temporary logger implementation for compilation
export const createServiceLogger = (serviceName: string) => {
    return {
        error: (message: string, meta?: any) => console.error(`[${serviceName}] ERROR:`, message, meta || ''),
        warn: (message: string, meta?: any) => console.warn(`[${serviceName}] WARN:`, message, meta || ''),
        info: (message: string, meta?: any) => console.info(`[${serviceName}] INFO:`, message, meta || ''),
        debug: (message: string, meta?: any) => console.debug(`[${serviceName}] DEBUG:`, message, meta || '')
    };
};

export default {
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
};