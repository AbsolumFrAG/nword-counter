import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { DatabaseService } from '../services/databaseService';
import { BaseCommand } from './baseCommand';

export class StatsCommand extends BaseCommand {
    public readonly data = new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Afficher les statistiques du serveur');

    protected readonly name = 'stats';

    constructor(private dbService: DatabaseService) {
        super();
    }

    protected async run(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!this.requireGuild(interaction)) return;

        const stats = await this.dbService.getGuildStats(interaction.guild!.id);

        const embed = new EmbedBuilder()
            .setTitle('📊 Statistiques du serveur')
            .setColor(0x00AE86)
            .setTimestamp()
            .setFooter({ text: `Serveur: ${interaction.guild!.name}` })
            .addFields(
                { name: '🔢 Total des détections', value: stats.totalDetections.toString(), inline: true },
                { name: '👥 Utilisateurs uniques', value: stats.uniqueUsers.toString(), inline: true },
                { name: '📈 Moyenne par utilisateur', value: stats.averagePerUser.toFixed(1), inline: true }
            );

        if (stats.topUser) {
            embed.addFields({ name: '👑 Champion actuel', value: `<@${stats.topUser}>`, inline: false });
        }

        await interaction.reply({ embeds: [embed] });
    }
}