import { ChatInputCommandInteraction, Client, GatewayIntentBits } from 'discord.js';
import { createCommands } from '../commands';
import { config } from '../config/environment';
import { AudioService } from '../services/audioService';
import { DatabaseService } from '../services/databaseService';
import { SpeechRecognitionService } from '../services/speechService';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('Bot');

export class DiscordBot {
    private client: Client;
    private commands: Map<string, any>;
    private dbService: DatabaseService;
    private speechService: SpeechRecognitionService;
    private audioService: AudioService;

    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages,
            ]
        });

        // Initialize services
        this.dbService = new DatabaseService();
        this.speechService = new SpeechRecognitionService();
        this.audioService = new AudioService(this.speechService, this.dbService);

        // Create commands
        this.commands = createCommands(this.dbService, this.audioService);

        this.setupEventHandlers();
    }

    /**
     * Setup Discord client event handlers
     */
    private setupEventHandlers(): void {
        this.client.once('ready', this.onReady.bind(this));
        this.client.on('interactionCreate', this.onInteractionCreate.bind(this));
        
        // Graceful shutdown
        process.on('SIGINT', this.shutdown.bind(this));
        process.on('SIGTERM', this.shutdown.bind(this));
    }

    /**
     * Bot ready event handler
     */
    private async onReady(): Promise<void> {
        logger.info(`Bot logged in`, { 
            username: this.client.user?.tag,
            id: this.client.user?.id,
            guilds: this.client.guilds.cache.size
        });

        try {
            // Initialize database
            await this.dbService.initialize();

            // Initialize speech recognition
            await this.speechService.initialize();

            // Register slash commands
            await this.registerCommands();

            logger.info('Bot initialization completed successfully');
        } catch (error) {
            logger.error('Bot initialization failed', { error });
            process.exit(1);
        }
    }

    /**
     * Interaction create event handler
     */
    private async onInteractionCreate(interaction: any): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        const command = this.commands.get(interaction.commandName);
        if (!command) {
            logger.warn('Unknown command received', { 
                commandName: interaction.commandName,
                userId: interaction.user.id 
            });
            return;
        }

        await command.execute(interaction as ChatInputCommandInteraction);
    }

    /**
     * Register slash commands with Discord
     */
    private async registerCommands(): Promise<void> {
        try {
            const commandData = Array.from(this.commands.values()).map(cmd => cmd.data);
            
            await this.client.application?.commands.set(commandData);
            
            logger.info('Slash commands registered successfully', { 
                count: commandData.length,
                commands: commandData.map(cmd => cmd.name)
            });
        } catch (error) {
            logger.error('Failed to register slash commands', { error });
            throw error;
        }
    }

    /**
     * Start the bot
     */
    async start(): Promise<void> {
        try {
            await this.client.login(config.DISCORD_BOT_TOKEN);
        } catch (error) {
            logger.error('Failed to login to Discord', { error });
            throw error;
        }
    }

    /**
     * Graceful shutdown
     */
    private async shutdown(): Promise<void> {
        logger.info('Shutting down bot...');

        try {
            // Close database connections
            await this.dbService.close();
            
            // Cleanup speech service
            this.speechService.cleanup();
            
            // Destroy Discord client
            this.client.destroy();
            
            logger.info('Bot shutdown completed');
            process.exit(0);
        } catch (error) {
            logger.error('Error during shutdown', { error });
            process.exit(1);
        }
    }
}