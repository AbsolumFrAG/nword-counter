const { SlashCommandBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");
const logger = require("../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("disconnect")
    .setDescription("Déconnecte le bot du salon vocal."),
  async execute(interaction) {
    // Récupération de la connexion vocale du bot pour le serveur courant
    const connection = getVoiceConnection(interaction.guild.id);

    if (!connection) {
      return interaction.reply({
        content: "Le bot n'est pas connecté à un salon vocal.",
        ephemeral: true,
      });
    }

    try {
      connection.destroy();
      logger.info(
        `Bot déconnecté du salon vocal sur le serveur ${interaction.guild.id}`
      );
      await interaction.reply("Bot déconnecté du salon vocal.");
    } catch (error) {
      logger.error(`Erreur lors de la déconnexion du bot: ${error.message}`);
      await interaction.reply({
        content: "Une erreur est survenue lors de la déconnexion du bot.",
        ephemeral: true,
      });
    }
  },
};
