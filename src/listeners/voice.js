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

// Map pour garder une trace des sessions actives par utilisateur
const activeSessions = new Map();

async function processAudioStream(opusStream, pcmFilePath) {
  const writeStream = fs.createWriteStream(pcmFilePath);
  try {
    await streamPipeline(
      opusStream,
      new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }),
      writeStream
    );
    return true;
  } catch (error) {
    logger.error(`Erreur lors du décodage Opus: ${error.message}`);
    writeStream.end();
    return false;
  }
}

async function convertToWav(pcmFilePath, wavFilePath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(pcmFilePath)
      .inputFormat("s16le")
      .inputOptions(["-ar 48000", "-ac 2", "-f s16le"])
      .output(wavFilePath)
      .outputOptions(["-acodec pcm_s16le", "-ar 16000", "-ac 1"])
      .on("end", resolve)
      .on("error", (error) => {
        logger.error(`Erreur FFmpeg : ${error.message}`);
        reject(error);
      })
      .run();
  });
}

function setupVoiceListeners(connection) {
  connection.receiver.speaking.on("start", async (userId) => {
    // Vérifier si l'utilisateur a déjà une session active
    if (activeSessions.has(userId)) {
      logger.warn(`Session déjà active pour l'utilisateur ${userId}, ignoré`);
      return;
    }

    // Marquer la session comme active
    activeSessions.set(userId, true);

    logger.info(`L'utilisateur ${userId} a commencé à parler.`);

    const tempDir = path.resolve(__dirname, "../../temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const sessionId = Date.now();
    const pcmFilePath = path.join(tempDir, `audio-${userId}-${sessionId}.raw`);
    const wavFilePath = path.join(tempDir, `audio-${userId}-${sessionId}.wav`);

    try {
      const opusStream = connection.receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 2000 },
      });

      // Traitement du flux audio avec gestion d'erreur
      const success = await processAudioStream(opusStream, pcmFilePath);
      if (!success) {
        logger.warn(`Échec du traitement audio pour l'utilisateur ${userId}`);
        return;
      }

      logger.info(`Audio PCM enregistré pour l'utilisateur ${userId}`);

      // Vérification de la taille du fichier
      const stats = await fs.promises.stat(pcmFilePath);
      if (stats.size < 1024) {
        logger.warn("Fichier audio trop petit, ignoré");
        return;
      }

      // Conversion vers WAV avec gestion d'erreur
      try {
        await convertToWav(pcmFilePath, wavFilePath);
        logger.info(`Audio converti en WAV pour l'utilisateur ${userId}`);
      } catch (error) {
        logger.error(`Erreur de conversion WAV: ${error.message}`);
        return;
      }

      // Transcription avec gestion d'erreur
      let transcription;
      try {
        transcription = await whisper.transcribeAudio(wavFilePath);
        logger.info(
          `Transcription pour l'utilisateur ${userId}: ${transcription}`
        );
      } catch (error) {
        logger.error(`Erreur de transcription: ${error.message}`);
        return;
      }

      // Détection du n-word
      if (transcription && transcription.length > 0) {
        const nWordRegex = /\b(n[ieé]g(?:g(?:a|er)|ro|nouf)s?)\b/gi;
        const matches = transcription.match(nWordRegex);
        if (matches && matches.length > 0) {
          const count = matches.length;
          logger.warn(
            `N-word détecté ${count} fois pour l'utilisateur ${userId}`
          );
          await db.incrementUserCount(userId, userId, count);
        }
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

      // Libérer la session
      activeSessions.delete(userId);
      logger.info(`Session terminée pour l'utilisateur ${userId}`);
    }
  });

  // Gestion des erreurs de connexion
  connection.on("error", (error) => {
    logger.error(`Erreur de connexion vocale: ${error.message}`);
    // Nettoyer toutes les sessions actives
    activeSessions.clear();
  });

  connection.on("disconnect", () => {
    logger.info("Connexion vocale déconnectée");
    // Nettoyer toutes les sessions actives
    activeSessions.clear();
  });
}

module.exports = {
  setupVoiceListeners,
};
