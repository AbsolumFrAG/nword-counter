const fs = require("fs");
const FormData = require("form-data");
const axios = require("axios");
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
  try {
    const form = new FormData();
    form.append("audio_file", fs.createReadStream(audioFilePath), {
      filename: "audio.wav",
      contentType: "audio/wav",
    });

    logger.info("Envoi de la requête à Whisper API...");
    const response = await axios.post(`${API_BASE_URL}/asr`, form, {
      params: {
        language: API_LANGUAGE,
        task: "transcribe",
        output: "json",
        word_timestamps: false,
      },
      headers: {
        ...form.getHeaders(),
        Accept: "application/json",
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    logger.info(`Réponse de l'API Whisper: ${JSON.stringify(response.data)}`);

    if (!response.data || !response.data.text) {
      logger.warn("La transcription renvoyée est vide");
      return "";
    }

    return response.data.text;
  } catch (error) {
    if (error.response) {
      logger.error(
        `Erreur HTTP ${error.response.status}: ${JSON.stringify(
          error.response.data
        )}`
      );
      logger.error(
        `Headers de réponse: ${JSON.stringify(error.response.headers)}`
      );
    } else if (error.request) {
      logger.error("Pas de réponse reçue du serveur");
    } else {
      logger.error(`Erreur lors de la requête: ${error.message}`);
    }
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
