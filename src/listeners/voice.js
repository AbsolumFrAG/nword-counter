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
    // Log de débogage du PCM
    const pcmData = await fs.promises.readFile(pcmPath);
    logger.info(`PCM brut lu : ${pcmData.length} octets`);

    // Vérification que le PCM n'est pas vide ou trop petit
    if (pcmData.length < 1024) {
      logger.warn("PCM trop petit, probablement pas d'audio valide");
      throw new Error("PCM trop petit");
    }

    // Vérification des données PCM
    const samples = new Int16Array(pcmData.buffer);
    logger.info(`Nombre d'échantillons PCM : ${samples.length}`);

    // Vérification du niveau audio (RMS)
    let rms = 0;
    for (let i = 0; i < samples.length; i++) {
      rms += samples[i] * samples[i];
    }
    rms = Math.sqrt(rms / samples.length);
    logger.info(`Niveau RMS du signal : ${rms}`);

    if (rms < 100) {
      // Seuil arbitraire, à ajuster
      logger.warn("Niveau audio très bas");
    }

    // Conversion stéréo vers mono
    const monoSamples = new Int16Array(samples.length / 2);
    for (let i = 0; i < monoSamples.length; i++) {
      monoSamples[i] = Math.round((samples[i * 2] + samples[i * 2 + 1]) / 2);
    }
    logger.info(`Échantillons mono : ${monoSamples.length}`);

    // Sous-échantillonnage de 48kHz à 16kHz
    const downsampledLength = Math.floor(monoSamples.length / 3);
    const downsampledSamples = new Int16Array(downsampledLength);
    for (let i = 0; i < downsampledLength; i++) {
      downsampledSamples[i] = monoSamples[i * 3];
    }
    logger.info(
      `Échantillons après sous-échantillonnage : ${downsampledSamples.length}`
    );

    // Normalisation du signal (amplification)
    let maxSample = 0;
    for (let i = 0; i < downsampledSamples.length; i++) {
      maxSample = Math.max(maxSample, Math.abs(downsampledSamples[i]));
    }

    const normalizationFactor = maxSample > 0 ? 32767 / maxSample : 1;
    for (let i = 0; i < downsampledSamples.length; i++) {
      downsampledSamples[i] = Math.round(
        downsampledSamples[i] * normalizationFactor
      );
    }

    // Création du WAV
    const wav = new WaveFile();
    wav.fromScratch(1, 16000, "16", Buffer.from(downsampledSamples.buffer));

    // Vérification du WAV avant sauvegarde
    logger.info(
      `Format WAV : ${wav.fmt.numChannels} canaux, ${wav.fmt.sampleRate}Hz, ${wav.fmt.bitsPerSample} bits`
    );
    logger.info(`Taille des données WAV : ${wav.data.samples.length} octets`);

    // Sauvegarde du WAV
    await fs.promises.writeFile(wavPath, wav.toBuffer());

    // Vérification finale du fichier sauvegardé
    const stats = await fs.promises.stat(wavPath);
    logger.info(`Fichier WAV écrit : ${stats.size} octets`);

    return stats.size > 1024; // Retourne true si le fichier est suffisamment grand
  } catch (error) {
    logger.error(`Erreur lors de la conversion WAV : ${error.message}`);
    throw error;
  }
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
      await streamPipeline(opusStream, decoder, writeStream);
      logger.info(`Audio enregistré pour l'utilisateur ${userId}`);

      // Conversion en WAV et vérification si l'audio est valide
      const isValidAudio = await convertPCMtoWAV(pcmFilePath, wavFilePath);

      if (!isValidAudio) {
        logger.warn("Audio ignoré car trop court ou invalide");
        return;
      }

      const transcription = await whisper.transcribeAudio(wavFilePath);
      logger.info(
        `Transcription pour l'utilisateur ${userId}: ${transcription}`
      );

      const nWordRegex = /\b(nigg(?:a|er))\b/i;
      if (nWordRegex.test(transcription)) {
        logger.warn(`N-word détecté pour l'utilisateur ${userId}`);
        await db.incrementUserCount(userId, userId, 1);
      }
    } catch (error) {
      logger.error(`Erreur lors du traitement de l'audio: ${error.message}`);
    } finally {
      // Nettoyage
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
