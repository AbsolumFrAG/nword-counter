const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { EndBehaviorType } = require("@discordjs/voice");
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
      // Récupération du flux audio
      const opusStream = connection.receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 2000 },
      });

      // Créer le processus FFmpeg
      const ffmpeg = spawn("ffmpeg", [
        "-f",
        "s16le", // Format d'entrée
        "-ar",
        "48000", // Sample rate
        "-ac",
        "2", // Canaux (stereo)
        "-i",
        "-", // Input from pipe
        "-ar",
        "16000", // Output sample rate pour Whisper
        "-ac",
        "1", // Output mono
        "-f",
        "wav", // Format de sortie
        wavFilePath, // Fichier de sortie
      ]);

      // Pipe le flux audio vers FFmpeg
      opusStream.pipe(ffmpeg.stdin);

      // Attente de la fin de la conversion
      await new Promise((resolve, reject) => {
        let errorOutput = "";

        ffmpeg.stderr.on("data", (data) => {
          errorOutput += data;
        });

        ffmpeg.on("close", (code) => {
          if (code !== 0) {
            logger.error(`FFmpeg error output: ${errorOutput}`);
            reject(new Error(`FFmpeg exited with code ${code}`));
            return;
          }
          resolve();
        });
      });

      // Vérification de la taille du fichier
      const stats = await fs.promises.stat(wavFilePath);
      if (stats.size < 1024) {
        logger.warn("Fichier audio trop petit, ignoré");
        return;
      }

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
