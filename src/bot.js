require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Client, Collection, GatewayIntentBits } = require("discord.js");
const logger = require("./utils/logger");
const { initializeDatabase } = require("./utils/db");

// Création d'une instance du client Discord avec les intents nécessaires
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// Création d'une collection pour stocker les commandes slash
client.commands = new Collection();

// Chargement des fichiers de commandes depuis le dossier "src/commands"
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  // On ajoute la commande à la collection avec son nom comme clé
  client.commands.set(command.data.name, command);
  logger.info(`Commande chargée : ${command.data.name}`);
}

// Une fois le bot connecté, on initialise la base de données et on logue son état
client.once("ready", () => {
  logger.info(`Bot connecté en tant que ${client.user.tag}`);
  initializeDatabase();
});

// Gestion des interactions (commandes slash)
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(
      `Erreur lors de l'exécution de la commande ${interaction.commandName} : ${error.message}`
    );
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "Une erreur est survenue lors de l'exécution de la commande.",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "Une erreur est survenue lors de l'exécution de la commande.",
        ephemeral: true,
      });
    }
  }
});

// Connexion du bot à Discord grâce au token défini dans le fichier .env
client.login(process.env.DISCORD_TOKEN);
