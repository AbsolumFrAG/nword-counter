const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream");
const { promisify } = require("util");
const { EndBehaviorType } = require("@discordjs/voice");
const prism = require("prism-media");
const whisper = require("../utils/whisper");
const logger = require("../utils/logger");
const db = require("../utils/db");

const streamPipeline = promisify(pipeline);

/**
 * Met en place les écouteurs d'événements pour traiter l'audio des utilisateurs dans un salon vocal.
 * Le flux audio reçu de Discord est en format Opus et doit être décodé en PCM avant d'être traité.
 * @param {VoiceConnection} connection - L'instance de connexion au salon vocal.
 */
function setupVoiceListeners(connection) {
  // Lorsqu'un utilisateur commence à parler...
  connection.receiver.speaking.on("start", async (userId) => {
    logger.info(`L'utilisateur ${userId} a commencé à parler.`);

    // Création du dossier temporaire s'il n'existe pas
    const tempDir = path.resolve(__dirname, "../../temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    // Définition d'un chemin temporaire pour stocker l'audio enregistré
    const tempFilePath = path.join(
      tempDir,
      `audio-${userId}-${Date.now()}.pcm`
    );

    // Souscription au flux audio Opus de l'utilisateur avec fin après silence (ici 1 seconde)
    const opusStream = connection.receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 2000 },
    });

    // Création d'un décodeur Opus pour convertir le flux en PCM (16-bit, 48kHz, 2 canaux)
    const decoder = new prism.opus.Decoder({
      frameSize: 960,
      channels: 2,
      rate: 48000,
    });

    // Création d'un flux d'écriture vers le fichier temporaire
    const writeStream = fs.createWriteStream(tempFilePath);

    try {
      // Pipeline : Flux Opus -> Décodage en PCM -> Fichier temporaire
      await streamPipeline(opusStream, decoder, writeStream);
      logger.info(
        `Audio enregistré pour l'utilisateur ${userId} dans le fichier ${tempFilePath}`
      );

      // Transcription de l'audio via le modèle Whisper
      const transcription = await whisper.transcribeAudio(tempFilePath);
      logger.info(
        `Transcription pour l'utilisateur ${userId}: ${transcription}`
      );

      // Détection du n-word dans la transcription (exemple avec regex)
      const nWordRegex = /\b(nigg(?:a|er))\b/i;
      if (nWordRegex.test(transcription)) {
        logger.warn(`N-word détecté pour l'utilisateur ${userId}`);
        await db.incrementUserCount(userId, userId, 1);
      }
    } catch (error) {
      logger.error(
        `Erreur lors du traitement de l'audio pour l'utilisateur ${userId}: ${error.message}`
      );
    } finally {
      // Suppression du fichier temporaire après traitement
      fs.unlink(tempFilePath, (err) => {
        if (err) {
          logger.error(
            `Erreur lors de la suppression du fichier temporaire ${tempFilePath}: ${err.message}`
          );
        } else {
          logger.info(`Fichier temporaire ${tempFilePath} supprimé.`);
        }
      });
    }
  });
}

module.exports = {
  setupVoiceListeners,
};
