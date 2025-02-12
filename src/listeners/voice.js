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
require("events").defaultMaxListeners = Infinity;

const streamPipeline = promisify(pipeline);

class AudioQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  async enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject,
      });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const { task, resolve, reject } = this.queue.shift();

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.isProcessing = false;
      this.processQueue();
    }
  }
}

const audioQueue = new AudioQueue();

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

async function processAudio(userId, opusStream) {
  const tempDir = path.resolve(__dirname, "../../temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const sessionId = Date.now();
  const pcmFilePath = path.join(tempDir, `audio-${userId}-${sessionId}.raw`);
  const wavFilePath = path.join(tempDir, `audio-${userId}-${sessionId}.wav`);

  try {
    // Traitement du flux audio
    const success = await processAudioStream(opusStream, pcmFilePath);
    if (!success) {
      throw new Error("Échec du traitement audio");
    }

    logger.info(`Audio PCM enregistré pour l'utilisateur ${userId}`);

    // Vérification de la taille du fichier
    const stats = await fs.promises.stat(pcmFilePath);
    if (stats.size < 1024) {
      throw new Error("Fichier audio trop petit");
    }

    // Conversion vers WAV
    await convertToWav(pcmFilePath, wavFilePath);
    logger.info(`Audio converti en WAV pour l'utilisateur ${userId}`);

    // Transcription
    const transcription = await whisper.transcribeAudio(wavFilePath);
    logger.info(`Transcription pour l'utilisateur ${userId}: ${transcription}`);

    // Détection du n-word
    if (transcription && transcription.length > 0) {
      const nWordRegex = /\b(n[ie]g(?:g(?:a|er)|ro|nouf)s?)\b/gi;
      const matches = transcription.match(nWordRegex);
      if (matches && matches.length > 0) {
        const count = matches.length;
        logger.warn(
          `N-word détecté ${count} fois pour l'utilisateur ${userId}`
        );
        await db.incrementUserCount(userId, userId, count);
      }
    }
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
}

function setupVoiceListeners(connection) {
  connection.receiver.speaking.on("start", async (userId) => {
    logger.info(`L'utilisateur ${userId} a commencé à parler.`);

    const opusStream = connection.receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 2000 },
    });

    // Ajouter le traitement à la queue
    audioQueue
      .enqueue(async () => {
        try {
          await processAudio(userId, opusStream);
        } catch (error) {
          if (error.message !== "Fichier audio trop petit") {
            logger.error(
              `Erreur lors du traitement audio dans la queue: ${error.message}`
            );
          }
        }
      })
      .catch((error) => {
        logger.error(`Erreur dans la queue audio: ${error.message}`);
      });
  });

  // Gestion des erreurs de connexion
  connection.on("error", (error) => {
    logger.error(`Erreur de connexion vocale: ${error.message}`);
  });

  connection.on("disconnect", () => {
    logger.info("Connexion vocale déconnectée");
  });
}

module.exports = {
  setupVoiceListeners,
};
