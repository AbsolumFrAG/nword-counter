declare module 'vosk' {
    export class Model {
        constructor(modelPath: string);
        free(): void;
    }

    export interface RecognizerOptions {
        model: Model;
        sampleRate: number;
    }

    export class Recognizer {
        constructor(options: RecognizerOptions);
        acceptWaveform(data: Buffer): boolean;
        result(): string;
        partialResult(): string;
        finalResult(): string;
        free(): void;
    }
}