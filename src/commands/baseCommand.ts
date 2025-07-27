import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from 'discord.js';
import { createServiceLogger } from '../utils/logger';
import { globalRateLimiter } from '../utils/rateLimiter';

const logger = createServiceLogger('Commands');

export abstract class BaseCommand {
    public abstract readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
    protected abstract readonly name: string;
    protected readonly rateLimited: boolean = true;

    /**
     * Execute the command with rate limiting and error handling
     */
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id || 'DM';

        logger.info('Command executed', { 
            command: this.name, 
            userId, 
            guildId,
            username: interaction.user.username 
        });

        try {
            // Check rate limiting
            if (this.rateLimited && globalRateLimiter.isRateLimited(userId)) {
                const cooldown = Math.ceil(globalRateLimiter.getRemainingCooldown(userId) / 1000);
                await interaction.reply({
                    content: `⏱️ Veuillez patienter ${cooldown} seconde(s) avant d'utiliser une autre commande.`,
                    ephemeral: true
                });
                return;
            }

            // Execute the actual command
            await this.run(interaction);

            logger.debug('Command completed successfully', { command: this.name, userId });

        } catch (error) {
            logger.error('Command execution failed', { 
                command: this.name, 
                userId, 
                guildId,
                error 
            });

            const errorMessage = 'Une erreur est survenue lors de l\'exécution de la commande.';

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ content: errorMessage });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            } catch (replyError) {
                logger.error('Failed to send error message', { command: this.name, userId, replyError });
            }
        }
    }

    /**
     * The actual command implementation
     */
    protected abstract run(interaction: ChatInputCommandInteraction): Promise<void>;

    /**
     * Check if command can only be used in guilds
     */
    protected requireGuild(interaction: ChatInputCommandInteraction): boolean {
        if (!interaction.guild) {
            interaction.reply({ 
                content: 'Cette commande ne peut être utilisée que dans un serveur !', 
                ephemeral: true 
            });
            return false;
        }
        return true;
    }
}