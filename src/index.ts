import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, CommandInteraction, VoiceChannel } from 'discord.js';
import { joinVoiceChannel, VoiceConnection, VoiceConnectionStatus, getVoiceConnection, EndBehaviorType } from '@discordjs/voice';
import * as dotenv from 'dotenv';
import { SpeechRecognitionService } from './speechRecognition';
import { pipeline, Transform } from 'stream';
import * as prism from 'prism-media';

// Load environment variables
dotenv.config();

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
    ]
});

// In-memory storage for word counts
const wordCounts = new Map<string, number>();

// Speech recognition service
const speechService = new SpeechRecognitionService();

// Bot ready event
client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}!`);

    // Initialize speech recognition
    try {
        await speechService.initialize();
        console.log('Speech recognition service initialized');
    } catch (error) {
        console.error('Failed to initialize speech recognition:', error);
        console.log('Bot will continue without speech recognition');
    }

    // Register slash commands
    const commands = [
        new SlashCommandBuilder()
            .setName('connect')
            .setDescription('Connect the bot to your voice channel'),
        new SlashCommandBuilder()
            .setName('disconnect')
            .setDescription('Disconnect the bot from the voice channel'),
        new SlashCommandBuilder()
            .setName('leaderboard')
            .setDescription('Afficher le classement des mots interdits')
    ];

    try {
        await client.application?.commands.set(commands);
        console.log('Slash commands registered successfully!');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'connect') {
        await handleConnect(interaction);
    } else if (commandName === 'disconnect') {
        await handleDisconnect(interaction);
    } else if (commandName === 'leaderboard') {
        await handleLeaderboard(interaction);
    }
});

// Connect command handler
async function handleConnect(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
        return;
    }

    const member = interaction.guild.members.cache.get(interaction.user.id);
    const voiceChannel = member?.voice.channel as VoiceChannel;

    if (!voiceChannel) {
        await interaction.reply({ content: 'You need to be in a voice channel first!', ephemeral: true });
        return;
    }

    try {
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: true
        });

        connection.on(VoiceConnectionStatus.Ready, () => {
            console.log('Connected to voice channel!');
            startListening(connection, voiceChannel);
        });

        await interaction.reply({ content: `Connected to ${voiceChannel.name}!`, ephemeral: true });
    } catch (error) {
        console.error('Error connecting to voice channel:', error);
        await interaction.reply({ content: 'Failed to connect to voice channel.', ephemeral: true });
    }
}

// Disconnect command handler
async function handleDisconnect(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
        return;
    }

    const connection = getVoiceConnection(interaction.guild.id);

    if (!connection) {
        await interaction.reply({ content: 'Bot is not connected to any voice channel!', ephemeral: true });
        return;
    }

    connection.destroy();
    await interaction.reply({ content: 'Disconnected from voice channel!', ephemeral: true });
}

// Leaderboard command handler
async function handleLeaderboard(interaction: CommandInteraction): Promise<void> {
    if (wordCounts.size === 0) {
        await interaction.reply({ content: 'Aucune détection pour le moment !', ephemeral: false });
        return;
    }

    // Sort users by count
    const sortedCounts = Array.from(wordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10

    const embed = new EmbedBuilder()
        .setTitle('Leaderboard - N-word')
        .setColor(0xFF0000)
        .setTimestamp();

    let description = '';
    sortedCounts.forEach(([userId, count], index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        description += `${medal} <@${userId}> - **${count}** times\n`;
    });

    embed.setDescription(description || 'No data available');

    await interaction.reply({ embeds: [embed] });
}

// Function to start listening to voice
function startListening(connection: VoiceConnection, _voiceChannel: VoiceChannel): void {
    console.log('Starting to listen for audio in voice channel...');

    // Get the receiver from the connection
    const receiver = connection.receiver;

    // Listen to audio from users
    receiver.speaking.on('start', (userId) => {
        console.log(`User ${userId} started speaking`);

        // Create a recognizer for this user
        const recognizer = speechService.createRecognizer(userId);
        if (!recognizer) {
            console.error(`Failed to create recognizer for user ${userId}`);
            return;
        }

        // Create audio stream for the user
        const audioStream = receiver.subscribe(userId, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: 1000,
            },
        });

        // Create decoder to convert Opus to PCM
        const opusDecoder = new prism.opus.Decoder({
            frameSize: 960,
            channels: 2,
            rate: 48000,
        });

        // Create a transform stream to convert stereo to mono and process audio
        const monoConverter = new Transform({
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

        // Process audio through the pipeline
        pipeline(
            audioStream,
            opusDecoder,
            monoConverter,
            new Transform({
                transform(chunk: Buffer, _encoding, callback) {
                    // Process audio chunk with Vosk
                    const text = speechService.processAudioChunk(userId, chunk);
                    if (text) {
                        console.log(`User ${userId} said: "${text}"`);

                        // Check for target words
                        if (speechService.detectTargetWords(text)) {
                            incrementWordCount(userId);
                            console.log(`Detected target word from user ${userId}`);
                        }
                    }
                    callback();
                }
            }),
            (err) => {
                if (err) {
                    console.error('Pipeline error:', err);
                }

                // Get final result when stream ends
                const finalText = speechService.getFinalResult(userId);
                if (finalText) {
                    console.log(`User ${userId} final text: "${finalText}"`);

                    // Check final text for target words
                    if (speechService.detectTargetWords(finalText)) {
                        incrementWordCount(userId);
                        console.log(`Detected target word from user ${userId} in final text`);
                    }
                }
            }
        );
    });
}

// Function to increment word count for a user
function incrementWordCount(userId: string): void {
    const currentCount = wordCounts.get(userId) || 0;
    wordCounts.set(userId, currentCount + 1);
}

// Login the bot
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
    console.error('DISCORD_BOT_TOKEN is not set in environment variables!');
    process.exit(1);
}

client.login(token);