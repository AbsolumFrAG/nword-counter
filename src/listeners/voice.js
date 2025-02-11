const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream");
const { promisify } = require("util");
const { EndBehaviorType } = require("@discordjs/voice");
const prism = require("prism-media");
const ffmpeg = require("fluent-ffmpeg");
const whisper = require("../utils/whisper");
const logger = require("../utils/logger");
const db = require("../utils/db");

const streamPipeline = promisify(pipeline);

/**
 * Convertit un fichier PCM en WAV en utilisant FFmpeg
 * @param {string} pcmPath - Chemin du fichier PCM
 * @param {string} wavPath - Chemin de sortie du fichier WAV
 */
function convertPCMtoWAV(pcmPath, wavPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(pcmPath)
      .inputOptions([
        "-f s16le", // Format d'entrée: PCM 16-bit little-endian
        "-ar 48000", // Fréquence d'échantillonnage d'entrée: 48kHz
        "-ac 2", // Nombre de canaux d'entrée: 2 (stéréo)
      ])
      .outputOptions([
        "-acodec pcm_s16le", // Codec de sortie: PCM 16-bit
        "-ar 16000", // Fréquence d'échantillonnage de sortie: 16kHz
        "-ac 1", // Nombre de canaux de sortie: 1 (mono)
      ])
      .on("start", (commandLine) => {
        logger.info("Commande FFmpeg: " + commandLine);
      })
      .on("error", (err) => {
        logger.error("Erreur FFmpeg: " + err.message);
        reject(err);
      })
      .on("end", () => {
        logger.info("Conversion FFmpeg terminée");
        resolve();
      })
      .save(wavPath);
  });
}

/**
 * Met en place les écouteurs d'événements pour traiter l'audio.
 */
function setupVoiceListeners(connection) {
  connection.receiver.speaking.on("start", async (userId) => {
    logger.info(`L'utilisateur ${userId} a commencé à parler.`);

    const tempDir = path.resolve(__dirname, "../../temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const pcmFilePath = path.join(tempDir, `audio-${userId}-${Date.now()}.pcm`);
    const wavFilePath = path.join(tempDir, `audio-${userId}-${Date.now()}.wav`);

    const opusStream = connection.receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 2000 },
    });

    const decoder = new prism.opus.Decoder({
      frameSize: 960,
      channels: 2,
      rate: 48000,
    });

    const writeStream = fs.createWriteStream(pcmFilePath);

    try {
      // Enregistrement du PCM
      await streamPipeline(opusStream, decoder, writeStream);
      logger.info(`Audio enregistré pour l'utilisateur ${userId}`);

      // Vérification de la taille du fichier PCM
      const stats = await fs.promises.stat(pcmFilePath);
      if (stats.size < 1024) {
        logger.warn("Fichier audio trop petit, ignoré");
        return;
      }

      // Conversion PCM vers WAV avec FFmpeg
      await convertPCMtoWAV(pcmFilePath, wavFilePath);

      // Transcription
      const transcription = await whisper.transcribeAudio(wavFilePath);
      logger.info(
        `Transcription pour l'utilisateur ${userId}: ${transcription}`
      );

      // Détection du n-word
      const nWordRegex = /\b(n[ie]g(?:g(?:a|er)|ro|nouf)s?)\b/i;
      if (nWordRegex.test(transcription)) {
        logger.warn(`N-word détecté pour l'utilisateur ${userId}`);
        await db.incrementUserCount(userId, userId, 1);
      }
    } catch (error) {
      logger.error(`Erreur lors du traitement de l'audio: ${error.message}`);
    } finally {
      // Nettoyage des fichiers temporaires
      for (const file of [pcmFilePath, wavFilePath]) {
        try {
          await fs.promises.unlink(file);
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
