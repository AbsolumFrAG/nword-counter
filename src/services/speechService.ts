// Re-export with better name and logging integration
import { SpeechRecognitionService as OriginalSpeechService } from '../speechRecognition';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('Speech');

export class SpeechRecognitionService extends OriginalSpeechService {
    constructor() {
        super();
        logger.info('Speech recognition service created');
    }

    async initialize(): Promise<void> {
        try {
            await super.initialize();
            logger.info('Speech recognition service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize speech recognition service', { error });
            throw error;
        }
    }

    createRecognizer(userId: string): any {
        const recognizer = super.createRecognizer(userId);
        if (recognizer) {
            logger.debug('Recognizer created for user', { userId });
        } else {
            logger.warn('Failed to create recognizer for user', { userId });
        }
        return recognizer;
    }

    detectTargetWords(text: string): boolean {
        const result = super.detectTargetWords(text);
        if (result) {
            logger.info('Target words detected in text', { 
                textLength: text.length,
                hasTargetWords: true 
            });
        }
        return result;
    }
}