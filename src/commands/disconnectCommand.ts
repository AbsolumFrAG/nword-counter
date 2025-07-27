import { getVoiceConnection } from '@discordjs/voice';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BaseCommand } from './baseCommand';

export class DisconnectCommand extends BaseCommand {
    public readonly data = new SlashCommandBuilder()
        .setName('disconnect')
        .setDescription('Disconnect the bot from the voice channel');

    protected readonly name = 'disconnect';
    protected readonly rateLimited = false; // Allow immediate disconnect

    protected async run(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!this.requireGuild(interaction)) return;

        const connection = getVoiceConnection(interaction.guild!.id);

        if (!connection) {
            await interaction.reply({ 
                content: 'Bot is not connected to any voice channel!', 
                ephemeral: true 
            });
            return;
        }

        connection.destroy();
        await interaction.reply({ 
            content: 'Disconnected from voice channel!', 
            ephemeral: true 
        });
    }
}