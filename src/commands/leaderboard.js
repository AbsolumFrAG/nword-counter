const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const logger = require("../utils/logger");
const db = require("../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription(
      "Affiche le classement des utilisateurs ayant mentionné le n-word."
    ),
  async execute(interaction) {
    try {
      // Récupération des 10 premiers utilisateurs du leaderboard
      const leaderboard = await db.getLeaderboard(10);

      if (!leaderboard || leaderboard.length === 0) {
        return interaction.reply(
          "Aucun utilisateur n'a encore mentionné le n-word."
        );
      }

      // Création d'un embed pour une meilleure présentation
      const embed = new EmbedBuilder()
        .setTitle("Leaderboard des utilisateurs")
        .setDescription("Classement basé sur le nombre de mentions du n-word")
        .setColor(0xff0000)
        .setTimestamp();

      let description = "";
      leaderboard.forEach((user, index) => {
        // Mention de l'utilisateur en utilisant son ID pour une meilleure lisibilité sur Discord
        description += `**${index + 1}.** <@${user.user_id}> - ${
          user.n_word_count
        } mentions\n`;
      });
      embed.setDescription(description);

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      logger.error(
        `Erreur lors de la récupération du leaderboard : ${error.message}`
      );
      return interaction.reply(
        "Une erreur est survenue lors de la récupération du leaderboard."
      );
    }
  },
};
