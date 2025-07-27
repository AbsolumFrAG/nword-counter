import { EndBehaviorType, getVoiceConnection, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { ChatInputCommandInteraction, Client, EmbedBuilder, GatewayIntentBits, SlashCommandBuilder, VoiceChannel } from 'discord.js';
import * as dotenv from 'dotenv';
import * as prism from 'prism-media';
import { pipeline, Transform } from 'stream';
import { DatabaseService } from './database';
import { SpeechRecognitionService } from './speechRecognition';

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

// Speech recognition service
const speechService = new SpeechRecognitionService();

// Database service
const dbService = new DatabaseService();

// Bot ready event
client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}!`);

    // Initialize database
    try {
        const dbConnected = await dbService.testConnection();
        if (dbConnected) {
            await dbService.initialize();
            console.log('Database initialized successfully');
        } else {
            console.error('Failed to connect to database');
            process.exit(1);
        }
    } catch (error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    }

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
            .setDescription('Afficher le classement des mots interdits'),
        new SlashCommandBuilder()
            .setName('stats')
            .setDescription('Afficher les statistiques du serveur'),
        new SlashCommandBuilder()
            .setName('reset')
            .setDescription('Réinitialiser le classement')
            .addStringOption(option =>
                option.setName('type')
                    .setDescription('Type de réinitialisation')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Mes scores', value: 'user' },
                        { name: 'Tout le serveur (admin)', value: 'guild' }
                    )
            )
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
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'connect') {
        await handleConnect(interaction);
    } else if (commandName === 'disconnect') {
        await handleDisconnect(interaction);
    } else if (commandName === 'leaderboard') {
        await handleLeaderboard(interaction);
    } else if (commandName === 'stats') {
        await handleStats(interaction);
    } else if (commandName === 'reset') {
        await handleReset(interaction);
    }
});

// Connect command handler
async function handleConnect(interaction: ChatInputCommandInteraction): Promise<void> {
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
async function handleDisconnect(interaction: ChatInputCommandInteraction): Promise<void> {
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
async function handleLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
        await interaction.reply({ content: 'Cette commande ne peut être utilisée que dans un serveur !', ephemeral: true });
        return;
    }

    try {
        const rankings = await dbService.getLeaderboard(interaction.guild.id, 10);

        if (rankings.length === 0) {
            await interaction.reply({ content: 'Aucune détection pour le moment !', ephemeral: false });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🏆 Classement - Mots interdits')
            .setColor(0xFF0000)
            .setTimestamp()
            .setFooter({ text: `Serveur: ${interaction.guild.name}` });

        let description = '';
        rankings.forEach((ranking, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            const lastDetection = new Date(ranking.last_detection).toLocaleDateString('fr-FR');
            description += `${medal} <@${ranking.user_id}> - **${ranking.count}** fois _(${lastDetection})_\n`;
        });

        embed.setDescription(description);

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in leaderboard command:', error);
        await interaction.reply({ content: 'Erreur lors de la récupération du classement.', ephemeral: true });
    }
}

// Stats command handler
async function handleStats(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
        await interaction.reply({ content: 'Cette commande ne peut être utilisée que dans un serveur !', ephemeral: true });
        return;
    }

    try {
        const stats = await dbService.getGuildStats(interaction.guild.id);

        const embed = new EmbedBuilder()
            .setTitle('📊 Statistiques du serveur')
            .setColor(0x00AE86)
            .setTimestamp()
            .setFooter({ text: `Serveur: ${interaction.guild.name}` })
            .addFields(
                { name: '🔢 Total des détections', value: stats.totalDetections.toString(), inline: true },
                { name: '👥 Utilisateurs uniques', value: stats.uniqueUsers.toString(), inline: true },
                { name: '📈 Moyenne par utilisateur', value: stats.averagePerUser.toFixed(1), inline: true }
            );

        if (stats.topUser) {
            embed.addFields({ name: '👑 Champion actuel', value: `<@${stats.topUser}>`, inline: false });
        }

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in stats command:', error);
        await interaction.reply({ content: 'Erreur lors de la récupération des statistiques.', ephemeral: true });
    }
}

// Reset command handler
async function handleReset(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
        await interaction.reply({ content: 'Cette commande ne peut être utilisée que dans un serveur !', ephemeral: true });
        return;
    }

    const resetType = interaction.options.getString('type');

    try {
        if (resetType === 'user') {
            const success = await dbService.resetUserCount(interaction.user.id, interaction.guild.id);
            if (success) {
                await interaction.reply({ content: '✅ Votre score a été réinitialisé !', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Aucun score à réinitialiser.', ephemeral: true });
            }
        } else if (resetType === 'guild') {
            // Check if user has admin permissions
            const member = interaction.guild.members.cache.get(interaction.user.id);
            if (!member?.permissions.has('Administrator')) {
                await interaction.reply({ content: '❌ Seuls les administrateurs peuvent réinitialiser le classement du serveur.', ephemeral: true });
                return;
            }

            const resetCount = await dbService.resetGuildCounts(interaction.guild.id);
            await interaction.reply({ content: `✅ Classement du serveur réinitialisé ! ${resetCount} utilisateur(s) affecté(s).`, ephemeral: false });
        }
    } catch (error) {
        console.error('Error in reset command:', error);
        await interaction.reply({ content: 'Erreur lors de la réinitialisation.', ephemeral: true });
    }
}

// Function to start listening to voice
function startListening(connection: VoiceConnection, voiceChannel: VoiceChannel): void {
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
                    // Feed audio chunk to Vosk for processing (no real-time text output)
                    speechService.processAudioChunk(userId, chunk);
                    callback();
                }
            }),
            (err) => {
                if (err) {
                    console.error('Pipeline error:', err);
                }

                // Get final result when user finishes speaking
                const finalText = speechService.getFinalResult(userId);
                if (finalText && finalText.trim()) {
                    console.log(`User ${userId} finished speaking: "${finalText}"`);

                    // Check final text for target words
                    if (speechService.detectTargetWords(finalText)) {
                        incrementWordCount(userId, voiceChannel.guild.id);
                        console.log(`Detected target word from user ${userId}: "${finalText}"`);
                    }
                }
            }
        );
    });
}

// Function to increment word count for a user
async function incrementWordCount(userId: string, guildId: string): Promise<void> {
    try {
        const newCount = await dbService.incrementWordCount(userId, guildId);
        console.log(`User ${userId} in guild ${guildId} now has ${newCount} detections`);
    } catch (error) {
        console.error('Error incrementing word count:', error);
    }
}

// Login the bot
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
    console.error('DISCORD_BOT_TOKEN is not set in environment variables!');
    process.exit(1);
}

client.login(token);