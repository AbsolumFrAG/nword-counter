const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream");
const { promisify } = require("util");
const { EndBehaviorType } = require("@discordjs/voice");
const opus = require("@discordjs/opus");
const ffmpeg = require("fluent-ffmpeg");
const whisper = require("../utils/whisper");
const logger = require("../utils/logger");
const db = require("../utils/db");

const streamPipeline = promisify(pipeline);

function convertPCMtoWAV(pcmPath, wavPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(pcmPath)
      .inputOptions(["-f s16le", "-ar 48000", "-ac 2"])
      .outputOptions(["-acodec pcm_s16le", "-ar 16000", "-ac 1"])
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

function setupVoiceListeners(connection) {
  connection.receiver.speaking.on("start", async (userId) => {
    logger.info(`L'utilisateur ${userId} a commencé à parler.`);

    const tempDir = path.resolve(__dirname, "../../temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const pcmFilePath = path.join(tempDir, `audio-${userId}-${Date.now()}.pcm`);
    const wavFilePath = path.join(tempDir, `audio-${userId}-${Date.now()}.wav`);

    try {
      const opusStream = connection.receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 2000 },
      });

      // Création d'un décodeur Opus natif
      const decoder = new opus.OpusEncoder(48000, 2);
      decoder.setBitrate(128000);

      const writeStream = fs.createWriteStream(pcmFilePath);

      // Transformation du flux Opus en PCM
      await streamPipeline(opusStream, writeStream);

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

      // Détection du n-word (en anglais et en français)
      const nWordRegex = /\b(n[ieé]g(?:g(?:a|er)|ro|nouf)s?)\b/i;
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
