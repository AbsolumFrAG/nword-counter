const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream");
const { promisify } = require("util");
const { EndBehaviorType } = require("@discordjs/voice");
const prism = require("prism-media");
const { WaveFile } = require("wavefile");
const whisper = require("../utils/whisper");
const logger = require("../utils/logger");
const db = require("../utils/db");

const streamPipeline = promisify(pipeline);

/**
 * Convertit un fichier PCM en WAV
 * @param {string} pcmPath - Chemin du fichier PCM
 * @param {string} wavPath - Chemin de sortie du fichier WAV
 */
async function convertPCMtoWAV(pcmPath, wavPath) {
  const pcmData = await fs.promises.readFile(pcmPath);

  // Créer un nouveau fichier WAV
  const wav = new WaveFile();

  // Configurer le format WAV avec les paramètres du PCM (16-bit, 48kHz, 2 canaux)
  wav.fromScratch(2, 48000, "16", pcmData);

  // Sauvegarder le fichier WAV
  await fs.promises.writeFile(wavPath, wav.toBuffer());
}

/**
 * Met en place les écouteurs d'événements pour traiter l'audio des utilisateurs dans un salon vocal.
 * @param {VoiceConnection} connection - L'instance de connexion au salon vocal.
 */
function setupVoiceListeners(connection) {
  connection.receiver.speaking.on("start", async (userId) => {
    logger.info(`L'utilisateur ${userId} a commencé à parler.`);

    // Création du dossier temporaire s'il n'existe pas
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
      logger.info(
        `Audio enregistré pour l'utilisateur ${userId} dans le fichier ${pcmFilePath}`
      );

      // Conversion en WAV
      await convertPCMtoWAV(pcmFilePath, wavFilePath);
      logger.info(`Audio converti en WAV pour l'utilisateur ${userId}`);

      // Transcription de l'audio via Whisper
      const transcription = await whisper.transcribeAudio(wavFilePath);
      logger.info(
        `Transcription pour l'utilisateur ${userId}: ${transcription}`
      );

      // Détection du n-word
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
      // Nettoyage des fichiers temporaires
      try {
        await fs.promises.unlink(pcmFilePath);
        await fs.promises.unlink(wavFilePath);
        logger.info(
          `Fichiers temporaires supprimés pour l'utilisateur ${userId}`
        );
      } catch (err) {
        logger.error(
          `Erreur lors de la suppression des fichiers temporaires: ${err.message}`
        );
      }
    }
  });
}

module.exports = {
  setupVoiceListeners,
};
