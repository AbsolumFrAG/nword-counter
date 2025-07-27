import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { DatabaseService } from '../services/databaseService';
import { BaseCommand } from './baseCommand';

export class ResetCommand extends BaseCommand {
    public readonly data = new SlashCommandBuilder()
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
        );

    protected readonly name = 'reset';

    constructor(private dbService: DatabaseService) {
        super();
    }

    protected async run(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!this.requireGuild(interaction)) return;

        const resetType = interaction.options.getString('type');

        if (resetType === 'user') {
            await this.handleUserReset(interaction);
        } else if (resetType === 'guild') {
            await this.handleGuildReset(interaction);
        }
    }

    private async handleUserReset(interaction: ChatInputCommandInteraction): Promise<void> {
        const success = await this.dbService.resetUserCount(
            interaction.user.id, 
            interaction.guild!.id
        );

        if (success) {
            await interaction.reply({ 
                content: '✅ Votre score a été réinitialisé !', 
                ephemeral: true 
            });
        } else {
            await interaction.reply({ 
                content: 'Aucun score à réinitialiser.', 
                ephemeral: true 
            });
        }
    }

    private async handleGuildReset(interaction: ChatInputCommandInteraction): Promise<void> {
        // Check admin permissions
        const member = interaction.guild!.members.cache.get(interaction.user.id);
        if (!member?.permissions.has('Administrator')) {
            await interaction.reply({ 
                content: '❌ Seuls les administrateurs peuvent réinitialiser le classement du serveur.', 
                ephemeral: true 
            });
            return;
        }

        const resetCount = await this.dbService.resetGuildCounts(interaction.guild!.id);
        
        await interaction.reply({ 
            content: `✅ Classement du serveur réinitialisé ! ${resetCount} utilisateur(s) affecté(s).`, 
            ephemeral: false 
        });
    }
}