const fs = require("fs");
const path = require("path");
const { EndBehaviorType } = require("@discordjs/voice");
const ffmpeg = require("fluent-ffmpeg");
const whisper = require("../utils/whisper");
const logger = require("../utils/logger");
const db = require("../utils/db");

function setupVoiceListeners(connection) {
  connection.receiver.speaking.on("start", async (userId) => {
    logger.info(`L'utilisateur ${userId} a commencé à parler.`);

    const tempDir = path.resolve(__dirname, "../../temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const wavFilePath = path.join(tempDir, `audio-${userId}-${Date.now()}.wav`);

    try {
      const opusStream = connection.receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 2000 },
      });

      const writeStream = fs.createWriteStream(wavFilePath);

      // Conversion directe de l'Opus en WAV avec FFmpeg
      ffmpeg(opusStream)
        .fromFormat("opus")
        .toFormat("wav")
        .outputOptions([
          "-ar 16000", // Fréquence d'échantillonnage: 16kHz
          "-ac 1", // Mono
        ])
        .on("error", (error) => {
          logger.error(`Erreur FFmpeg: ${error.message}`);
          throw error;
        })
        .pipe(writeStream);

      // Attendre que la conversion soit terminée
      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      logger.info(`Audio enregistré et converti pour l'utilisateur ${userId}`);

      // Vérification de la taille du fichier
      const stats = await fs.promises.stat(wavFilePath);
      if (stats.size < 1024) {
        logger.warn("Fichier audio trop petit, ignoré");
        return;
      }

      // Transcription
      const transcription = await whisper.transcribeAudio(wavFilePath);
      logger.info(
        `Transcription pour l'utilisateur ${userId}: ${transcription}`
      );

      // Détection du n-word (en anglais et en français)
      const nWordRegex = /\b(n[ieé]g(?:g(?:a|er)|ro|nouf)s?)\b/i;
      if (nWordRegex.test(transcription)) {
        logger.warn(`N-word détecté pour l'utilisateur ${userId}`);
        await db.incrementUserCount(userId, userId, 1);
      }
    } catch (error) {
      logger.error(`Erreur lors du traitement de l'audio: ${error.message}`);
    } finally {
      // Nettoyage du fichier temporaire
      try {
        if (fs.existsSync(wavFilePath)) {
          await fs.promises.unlink(wavFilePath);
          logger.info(`Fichier ${wavFilePath} supprimé`);
        }
      } catch (err) {
        logger.error(
          `Erreur lors de la suppression de ${wavFilePath}: ${err.message}`
        );
      }
    }
  });
}

module.exports = {
  setupVoiceListeners,
};
