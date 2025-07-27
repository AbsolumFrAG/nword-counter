const https = require("https");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream");
const { promisify } = require("util");
const extract = require("extract-zip");

const streamPipeline = promisify(pipeline);

// Model URL - using the small English model (40 MB)
const MODEL_URL =
  "https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip";
const MODEL_DIR = "./models";
const MODEL_NAME = "vosk-model-small-fr-0.22";
const ZIP_PATH = path.join(MODEL_DIR, `${MODEL_NAME}.zip`);

async function downloadModel() {
  console.log("Downloading Vosk model...");

  // Create models directory if it doesn't exist
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }

  // Check if model already exists
  if (fs.existsSync(path.join(MODEL_DIR, MODEL_NAME))) {
    console.log("Model already exists!");
    return;
  }

  return new Promise((resolve, reject) => {
    https
      .get(MODEL_URL, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers["content-length"], 10);
        let downloadedSize = 0;

        // Track download progress
        response.on("data", (chunk) => {
          downloadedSize += chunk.length;
          const percent = ((downloadedSize / totalSize) * 100).toFixed(2);
          process.stdout.write(`\rDownloading: ${percent}%`);
        });

        // Save to file
        const fileStream = fs.createWriteStream(ZIP_PATH);

        streamPipeline(response, fileStream)
          .then(() => {
            console.log("\nDownload complete!");
            resolve();
          })
          .catch(reject);
      })
      .on("error", reject);
  });
}

async function extractModel() {
  console.log("Extracting model...");

  try {
    await extract(ZIP_PATH, { dir: path.resolve(MODEL_DIR) });
    console.log("Extraction complete!");

    // Clean up zip file
    fs.unlinkSync(ZIP_PATH);
    console.log("Cleaned up zip file");
  } catch (error) {
    console.error("Extraction failed:", error);
    throw error;
  }
}

async function main() {
  try {
    await downloadModel();
    await extractModel();
    console.log("\nModel ready! You can now run the bot.");
  } catch (error) {
    console.error("\nError:", error.message);
    process.exit(1);
  }
}

// Check if extract-zip is installed
try {
  require.resolve("extract-zip");
  main();
} catch (e) {
  console.log("Installing extract-zip...");
  require("child_process").execSync("pnpm install extract-zip", {
    stdio: "inherit",
  });
  main();
}
