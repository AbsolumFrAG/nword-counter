import { joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import { ChatInputCommandInteraction, SlashCommandBuilder, VoiceChannel } from 'discord.js';
import { AudioService } from '../services/audioService';
import { BaseCommand } from './baseCommand';

export class ConnectCommand extends BaseCommand {
    public readonly data = new SlashCommandBuilder()
        .setName('connect')
        .setDescription('Connect the bot to your voice channel');

    protected readonly name = 'connect';

    constructor(private audioService: AudioService) {
        super();
    }

    protected async run(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!this.requireGuild(interaction)) return;

        const member = interaction.guild!.members.cache.get(interaction.user.id);
        const voiceChannel = member?.voice.channel as VoiceChannel;

        if (!voiceChannel) {
            await interaction.reply({ 
                content: 'You need to be in a voice channel first!', 
                ephemeral: true 
            });
            return;
        }

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: true
        });

        connection.on(VoiceConnectionStatus.Ready, () => {
            this.audioService.startListening(connection, voiceChannel);
        });

        await interaction.reply({ 
            content: `Connected to ${voiceChannel.name}!`, 
            ephemeral: true 
        });
    }
}