const { SlashCommandBuilder } = require("discord.js");
const { joinVoiceChannel } = require("@discordjs/voice");
const logger = require("../utils/logger");
const { setupVoiceListeners } = require("../listeners/voice");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("connect")
    .setDescription("Connecte le bot à votre salon vocal."),
  async execute(interaction) {
    // Vérification : l'utilisateur doit être dans un salon vocal
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({
        content:
          "Vous devez être dans un salon vocal pour utiliser cette commande.",
        ephemeral: true,
      });
    }

    try {
      // Création de la connexion au salon vocal
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
      });
      logger.info(
        `Connexion établie dans le salon vocal : ${voiceChannel.name} (${voiceChannel.id})`
      );

      // Mise en place des écouteurs pour capter l'audio
      setupVoiceListeners(connection);

      await interaction.reply(
        `Bot connecté dans le salon vocal : **${voiceChannel.name}**.`
      );
    } catch (error) {
      logger.error(
        `Erreur lors de la connexion au salon vocal : ${error.message}`
      );
      await interaction.reply({
        content: "Une erreur est survenue lors de la connexion au salon vocal.",
        ephemeral: true,
      });
    }
  },
};
