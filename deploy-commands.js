require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

// Récupération de toutes les commandes du dossier "src/commands"
const commands = [];
const commandsPath = path.join(__dirname, "src", "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// Récupération des IDs depuis les variables d'environnement
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID; // Optionnel : si défini, les commandes seront déployées uniquement sur cette guild

(async () => {
  try {
    console.log(`Déploiement de ${commands.length} commandes...`);

    if (guildId) {
      // Déploiement sur une guild spécifique (plus rapide pour les tests)
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log(`Commandes déployées dans la guild ${guildId} avec succès.`);
    } else {
      // Déploiement global (peut prendre jusqu'à 1 heure pour être effectif)
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log("Commandes globales déployées avec succès.");
    }
  } catch (error) {
    console.error("Erreur lors du déploiement des commandes :", error);
  }
})();
