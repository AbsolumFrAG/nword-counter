import * as fs from 'fs';
import { Model, Recognizer } from 'vosk';

export class SpeechRecognitionService {
    private model: Model | null = null;
    private recognizers: Map<string, Recognizer<any>> = new Map();
    private modelPath: string;

    constructor(modelPath: string = './models/vosk-model-small-fr-0.22') {
        this.modelPath = modelPath;
    }

    async initialize(): Promise<void> {
        try {
            // Check if model exists
            if (!fs.existsSync(this.modelPath)) {
                console.error(`Model not found at ${this.modelPath}`);
                console.log('Please download a Vosk model from https://alphacephei.com/vosk/models');
                console.log('Recommended: vosk-model-small-fr-0.22 (41 MB)');
                console.log('Extract it to ./models/ directory');
                throw new Error('Vosk model not found');
            }

            // Initialize Vosk model
            this.model = new Model(this.modelPath);
            console.log('Vosk model loaded successfully');
        } catch (error) {
            console.error('Failed to initialize Vosk:', error);
            throw error;
        }
    }

    createRecognizer(userId: string): Recognizer<any> | null {
        if (!this.model) {
            console.error('Model not initialized');
            return null;
        }

        try {
            // Create a recognizer for this user
            // Sample rate should match Discord's audio (48000 Hz)
            const recognizer = new Recognizer({ model: this.model, sampleRate: 48000 });
            this.recognizers.set(userId, recognizer);
            return recognizer;
        } catch (error) {
            console.error('Failed to create recognizer:', error);
            return null;
        }
    }

    processAudioChunk(userId: string, audioBuffer: Buffer): string | null {
        const recognizer = this.recognizers.get(userId);
        if (!recognizer) {
            console.error(`No recognizer found for user ${userId}`);
            return null;
        }

        try {
            // Process audio chunk
            const accepted = recognizer.acceptWaveform(audioBuffer);

            if (accepted) {
                // Get final result
                const result = recognizer.result();
                console.log(`processAudioChunk - accepted result for user ${userId}:`, result);
                console.log(`processAudioChunk - result type: ${typeof result}`);

                let resultStr;
                if (typeof result === 'string') {
                    resultStr = result;
                } else if (typeof result === 'object' && result !== null) {
                    resultStr = JSON.stringify(result);
                } else {
                    resultStr = String(result);
                }

                const parsed = JSON.parse(resultStr);
                return parsed.text || null;
            } else {
                // Get partial result
                const partialResult = recognizer.partialResult();
                console.log(`processAudioChunk - partial result for user ${userId}:`, partialResult);
                console.log(`processAudioChunk - partial result type: ${typeof partialResult}`);

                let partialStr;
                if (typeof partialResult === 'string') {
                    partialStr = partialResult;
                } else if (typeof partialResult === 'object' && partialResult !== null) {
                    partialStr = JSON.stringify(partialResult);
                } else {
                    partialStr = String(partialResult);
                }

                const parsed = JSON.parse(partialStr);
                return parsed.partial || null;
            }
        } catch (error) {
            console.error(`Error processing audio for user ${userId}:`, error);
            return null;
        }
    }

    getFinalResult(userId: string): string | null {
        const recognizer = this.recognizers.get(userId);
        if (!recognizer) {
            console.log(`No recognizer found for user ${userId}`);
            return null;
        }

        try {
            const finalResult = recognizer.finalResult();
            console.log(`Raw final result for user ${userId}:`, finalResult);
            console.log(`Final result type: ${typeof finalResult}`);
            console.log(`Final result constructor: ${finalResult?.constructor?.name}`);

            let parsed;
            if (typeof finalResult === 'string') {
                console.log(`Parsing string result: "${finalResult}"`);
                parsed = JSON.parse(finalResult);
            } else if (typeof finalResult === 'object' && finalResult !== null) {
                console.log('Final result is already an object, using directly');
                parsed = finalResult;
            } else {
                console.log('Unexpected final result format, converting to string');
                const stringResult = String(finalResult);
                console.log(`Converted to string: "${stringResult}"`);
                parsed = JSON.parse(stringResult);
            }

            console.log(`Parsed result for user ${userId}:`, parsed);

            // Clean up recognizer after getting final result
            recognizer.free();
            this.recognizers.delete(userId);

            const text = parsed.text || null;
            console.log(`Extracted text for user ${userId}: "${text}"`);
            return text;
        } catch (error) {
            console.error(`Error getting final result for user ${userId}:`, error);
            console.error('Error details:', {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });

            // Clean up recognizer even on error
            try {
                recognizer.free();
                this.recognizers.delete(userId);
            } catch (cleanupError) {
                console.error(`Error during cleanup for user ${userId}:`, cleanupError);
            }

            return null;
        }
    }

    detectTargetWords(text: string): boolean {
        if (!text) return false;

        // Convert to lowercase for case-insensitive matching
        const lowerText = text.toLowerCase();

        // List of patterns to detect "négro" and its variations
        const targetPatterns = [
            /\bn[eé]gro/i,           // négro, negro
            /\bn[eé]gros/i,          // négros, negros (pluriel)
            /\bn[eé]gress/i,         // négresse, negresse
            /\bn[eé]gresses/i,       // négresses, negresses (pluriel)
            /\bn[iì]gga/i,           // variantes phonétiques
            /\bn[iì]gger/i,          // variantes phonétiques
            /\bn[iì]ggas/i,          // pluriel
            /\bn[iì]ggers/i,         // pluriel
            /\bn[iì]ger/i,
            /\bn[iì]gers/i,
        ];

        return targetPatterns.some(pattern => pattern.test(lowerText));
    }

    cleanup(): void {
        // Clean up all recognizers
        for (const [userId, recognizer] of this.recognizers) {
            try {
                recognizer.free();
            } catch (error) {
                console.error(`Error freeing recognizer for user ${userId}:`, error);
            }
        }
        this.recognizers.clear();

        // Clean up model
        if (this.model) {
            try {
                this.model.free();
            } catch (error) {
                console.error('Error freeing model:', error);
            }
            this.model = null;
        }
    }
}