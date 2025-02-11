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
 * Convertit un fichier PCM en WAV compatible avec Whisper (16kHz, mono, 16-bit)
 * @param {string} pcmPath - Chemin du fichier PCM
 * @param {string} wavPath - Chemin de sortie du fichier WAV
 */
async function convertPCMtoWAV(pcmPath, wavPath) {
  try {
    const pcmData = await fs.promises.readFile(pcmPath);
    const wav = new WaveFile();

    // Le PCM d'origine est 48kHz stereo 16-bit
    // Convertissons-le en mono d'abord
    const samples = new Int16Array(pcmData.buffer);
    const monoSamples = new Int16Array(samples.length / 2);

    // Conversion stéréo vers mono en faisant la moyenne des canaux
    for (let i = 0; i < monoSamples.length; i++) {
      monoSamples[i] = Math.round((samples[i * 2] + samples[i * 2 + 1]) / 2);
    }

    // On garde un échantillon sur 3 pour passer de 48kHz à 16kHz
    const downsampledLength = Math.floor(monoSamples.length / 3);
    const downsampledSamples = new Int16Array(downsampledLength);

    for (let i = 0; i < downsampledLength; i++) {
      downsampledSamples[i] = monoSamples[i * 3];
    }

    // Création du WAV avec les nouveaux paramètres
    wav.fromScratch(
      1, // mono
      16000, // 16kHz
      "16", // 16-bit
      Buffer.from(downsampledSamples.buffer)
    );

    // Sauvegarde du fichier WAV
    await fs.promises.writeFile(wavPath, wav.toBuffer());
    logger.info(`WAV converti avec succès: ${wavPath} (16kHz, mono, 16-bit)`);
  } catch (error) {
    logger.error(`Erreur lors de la conversion WAV : ${error.message}`);
    throw error;
  }
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

      // Conversion en WAV compatible Whisper
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
