const fs = require("fs");
const FormData = require("form-data");
const logger = require("./logger");

const API_BASE_URL = process.env.WHISPER_API_URL || "http://localhost:9000";
const API_LANGUAGE = "fr";

class TranscriptionQueue {
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

      this.processQueue();
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

const transcriptionQueue = new TranscriptionQueue();

async function callWhisperAPI(audioFilePath) {
  const formData = new FormData();
  formData.append("audio_file", fs.createReadStream(audioFilePath), {
    filename: "audio.wav",
    contentType: "audio/wav",
  });

  try {
    const response = await fetch(
      `${API_BASE_URL}/asr?language=${API_LANGUAGE}&output=json`,
      {
        method: "POST",
        body: formData,
        headers: {
          ...formData.getHeaders(),
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Erreur HTTP ${response.status}: ${errorText}`);
      throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (!result || !result.text) {
      logger.warn("La transcription renvoyée est vide");
      return "";
    }

    return result.text;
  } catch (error) {
    logger.error(
      `Erreur détaillée lors de l'appel à Whisper: ${error.message}`
    );
    throw error;
  }
}

async function transcribeAudio(audioFilePath) {
  logger.info(`Ajout à la queue de transcription : ${audioFilePath}`);

  try {
    // Vérifier que le fichier existe
    await fs.promises.access(audioFilePath);

    // Afficher la taille du fichier
    const stats = await fs.promises.stat(audioFilePath);
    logger.info(`Taille du fichier audio : ${stats.size} octets`);

    const transcription = await transcriptionQueue.enqueue(async () => {
      logger.info(`Début de la transcription de l'audio : ${audioFilePath}`);
      return callWhisperAPI(audioFilePath);
    });

    logger.info("Transcription réalisée avec succès");
    return transcription;
  } catch (error) {
    logger.error(
      `Erreur lors de la transcription de l'audio : ${error.message}`
    );
    throw error;
  }
}

module.exports = {
  transcribeAudio,
};
