import { EndBehaviorType, VoiceConnection } from '@discordjs/voice';
import { VoiceChannel } from 'discord.js';
import * as prism from 'prism-media';
import { pipeline, Transform } from 'stream';
import { createServiceLogger } from '../utils/logger';
import { DatabaseService } from './databaseService';
import { SpeechRecognitionService } from './speechService';

const logger = createServiceLogger('Audio');

export class AudioService {
    private speechService: SpeechRecognitionService;
    private dbService: DatabaseService;

    constructor(speechService: SpeechRecognitionService, dbService: DatabaseService) {
        this.speechService = speechService;
        this.dbService = dbService;
    }

    /**
     * Start listening to voice in a channel
     */
    startListening(connection: VoiceConnection, voiceChannel: VoiceChannel): void {
        logger.info('Starting audio listening', { 
            channelId: voiceChannel.id, 
            channelName: voiceChannel.name,
            guildId: voiceChannel.guild.id 
        });

        const receiver = connection.receiver;

        receiver.speaking.on('start', (userId) => {
            logger.debug('User started speaking', { userId, channelId: voiceChannel.id });

            const recognizer = this.speechService.createRecognizer(userId);
            if (!recognizer) {
                logger.error('Failed to create recognizer', { userId });
                return;
            }

            this.setupAudioPipeline(userId, receiver, voiceChannel);
        });
    }

    /**
     * Setup audio processing pipeline for a user
     */
    private setupAudioPipeline(userId: string, receiver: any, voiceChannel: VoiceChannel): void {
        const audioStream = receiver.subscribe(userId, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: 1000,
            },
        });

        const opusDecoder = new prism.opus.Decoder({
            frameSize: 960,
            channels: 2,
            rate: 48000,
        });

        const monoConverter = this.createMonoConverter();

        pipeline(
            audioStream,
            opusDecoder,
            monoConverter,
            new Transform({
                transform: (chunk: Buffer, _encoding, callback) => {
                    this.speechService.processAudioChunk(userId, chunk);
                    callback();
                }
            }),
            (err) => {
                if (err) {
                    logger.error('Audio pipeline error', { userId, error: err.message });
                }

                this.processFinalResult(userId, voiceChannel.guild.id);
            }
        );
    }

    /**
     * Create mono converter transform stream
     */
    private createMonoConverter(): Transform {
        return new Transform({
            transform(chunk: Buffer, _encoding, callback) {
                // Convert stereo to mono by averaging channels
                const samples = chunk.length / 4; // 2 bytes per sample, 2 channels
                const monoBuffer = Buffer.alloc(samples * 2); // 2 bytes per sample, 1 channel

                for (let i = 0; i < samples; i++) {
                    const left = chunk.readInt16LE(i * 4);
                    const right = chunk.readInt16LE(i * 4 + 2);
                    const mono = Math.floor((left + right) / 2);
                    monoBuffer.writeInt16LE(mono, i * 2);
                }

                callback(null, monoBuffer);
            }
        });
    }

    /**
     * Process final speech recognition result
     */
    private async processFinalResult(userId: string, guildId: string): Promise<void> {
        try {
            const finalText = this.speechService.getFinalResult(userId);
            
            if (finalText && finalText.trim()) {
                logger.debug('User finished speaking', { userId, text: finalText });

                if (this.speechService.detectTargetWords(finalText)) {
                    await this.handleTargetWordDetection(userId, guildId, finalText);
                }
            }
        } catch (error) {
            logger.error('Error processing final result', { userId, guildId, error });
        }
    }

    /**
     * Handle target word detection
     */
    private async handleTargetWordDetection(userId: string, guildId: string, text: string): Promise<void> {
        try {
            const newCount = await this.dbService.incrementWordCount(userId, guildId);
            
            logger.info('Target word detected', { 
                userId, 
                guildId, 
                text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                newCount 
            });
        } catch (error) {
            logger.error('Error incrementing word count', { userId, guildId, error });
        }
    }
}