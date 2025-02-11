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

    const opusFilePath = path.join(
      tempDir,
      `audio-${userId}-${Date.now()}.opus`
    );
    const wavFilePath = path.join(tempDir, `audio-${userId}-${Date.now()}.wav`);

    try {
      // Récupération du flux audio
      const opusStream = connection.receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 2000 },
      });

      // Écriture du flux Opus brut dans un fichier
      const writeStream = fs.createWriteStream(opusFilePath);
      opusStream.pipe(writeStream);

      // Attente de la fin de l'écriture
      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      // Vérification de la taille du fichier
      const stats = await fs.promises.stat(opusFilePath);
      if (stats.size < 1024) {
        logger.warn("Fichier audio trop petit, ignoré");
        return;
      }

      logger.info(`Audio Opus enregistré pour l'utilisateur ${userId}`);

      // Conversion directe de l'Opus en WAV avec FFmpeg
      await new Promise((resolve, reject) => {
        ffmpeg(opusFilePath)
          .outputOptions([
            "-ar 16000", // Fréquence d'échantillonnage: 16kHz
            "-ac 1", // Mono
            "-c:a pcm_s16le", // Format WAV 16-bit
          ])
          .on("error", (error) => {
            logger.error(`Erreur FFmpeg: ${error.message}`);
            reject(error);
          })
          .on("end", () => {
            logger.info("Conversion FFmpeg terminée");
            resolve();
          })
          .save(wavFilePath);
      });

      logger.info(`Audio converti en WAV pour l'utilisateur ${userId}`);

      // Transcription
      const transcription = await whisper.transcribeAudio(wavFilePath);
      logger.info(
        `Transcription pour l'utilisateur ${userId}: ${transcription}`
      );

      // Détection du n-word (en anglais et en français)
      const nWordRegex = /\b(n[ieé]g(?:g(?:a|er)|ro|nouf)s?)\b/gi;
      const matches = transcription.match(nWordRegex);
      if (matches && matches.length > 0) {
        const count = matches.length;
        logger.warn(
          `N-word détecté ${count} fois pour l'utilisateur ${userId}`
        );
        await db.incrementUserCount(userId, userId, count);
      }
    } catch (error) {
      logger.error(`Erreur lors du traitement de l'audio: ${error.message}`);
    } finally {
      // Nettoyage des fichiers temporaires
      for (const file of [opusFilePath, wavFilePath]) {
        try {
          if (fs.existsSync(file)) {
            await fs.promises.unlink(file);
            logger.info(`Fichier ${file} supprimé`);
          }
        } catch (err) {
          logger.error(
            `Erreur lors de la suppression de ${file}: ${err.message}`
          );
        }
      }
    }
  });
}

module.exports = {
  setupVoiceListeners,
};
