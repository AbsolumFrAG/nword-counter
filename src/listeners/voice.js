const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream");
const { promisify } = require("util");
const { EndBehaviorType } = require("@discordjs/voice");
const ffmpeg = require("fluent-ffmpeg");
const prism = require("prism-media");
const whisper = require("../utils/whisper");
const logger = require("../utils/logger");
const db = require("../utils/db");

const streamPipeline = promisify(pipeline);

function setupVoiceListeners(connection) {
  connection.receiver.speaking.on("start", async (userId) => {
    logger.info(`L'utilisateur ${userId} a commencé à parler.`);

    const tempDir = path.resolve(__dirname, "../../temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const pcmFilePath = path.join(tempDir, `audio-${userId}-${Date.now()}.raw`);
    const wavFilePath = path.join(tempDir, `audio-${userId}-${Date.now()}.wav`);

    try {
      const opusStream = connection.receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 2000 },
      });

      // Création du flux de sortie PCM
      const writeStream = fs.createWriteStream(pcmFilePath);

      // Pipeline de conversion basique
      await streamPipeline(
        opusStream,
        new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }),
        writeStream
      );

      logger.info(`Audio PCM enregistré pour l'utilisateur ${userId}`);

      // Vérification de la taille du fichier
      const stats = await fs.promises.stat(pcmFilePath);
      if (stats.size < 1024) {
        logger.warn("Fichier audio trop petit, ignoré");
        return;
      }

      // Conversion PCM vers WAV avec FFmpeg
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(pcmFilePath)
          .inputFormat("s16le") // Format PCM 16-bit little-endian
          .inputOptions([
            "-ar 48000", // Fréquence d'échantillonnage d'entrée
            "-ac 2", // 2 canaux (stéréo)
            "-f s16le", // Format d'entrée PCM
          ])
          .output(wavFilePath)
          .outputOptions([
            "-acodec pcm_s16le", // Codec WAV
            "-ar 16000", // Conversion à 16kHz
            "-ac 1", // Conversion en mono
          ])
          .on("end", resolve)
          .on("error", (error) => {
            logger.error(`Erreur FFmpeg : ${error.message}`);
            reject(error);
          })
          .run();
      });

      logger.info(`Audio converti en WAV pour l'utilisateur ${userId}`);

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
