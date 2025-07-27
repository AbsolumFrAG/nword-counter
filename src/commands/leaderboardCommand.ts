import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { DatabaseService } from '../services/databaseService';
import { BaseCommand } from './baseCommand';

export class LeaderboardCommand extends BaseCommand {
    public readonly data = new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Afficher le classement des mots interdits');

    protected readonly name = 'leaderboard';

    constructor(private dbService: DatabaseService) {
        super();
    }

    protected async run(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!this.requireGuild(interaction)) return;

        const rankings = await this.dbService.getLeaderboard(interaction.guild!.id, 10);

        if (rankings.length === 0) {
            await interaction.reply({ 
                content: 'Aucune détection pour le moment !', 
                ephemeral: false 
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🏆 Classement - Mots interdits')
            .setColor(0xFF0000)
            .setTimestamp()
            .setFooter({ text: `Serveur: ${interaction.guild!.name}` });

        let description = '';
        rankings.forEach((ranking, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            const lastDetection = new Date(ranking.last_detection).toLocaleDateString('fr-FR');
            description += `${medal} <@${ranking.user_id}> - **${ranking.count}** fois _(${lastDetection})_\n`;
        });

        embed.setDescription(description);
        await interaction.reply({ embeds: [embed] });
    }
}