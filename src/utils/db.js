const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// Chemin vers le dossier contenant la base de données
const dataFolder = path.resolve(__dirname, "../../data");
// Vérification et création du dossier s'il n'existe pas
if (!fs.existsSync(dataFolder)) {
  fs.mkdirSync(dataFolder, { recursive: true });
}

// Chemin vers le fichier de base de données SQLite
const dbPath = path.join(dataFolder, "database.sqlite");

// Connexion à la base de données
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(
      "Erreur lors de la connexion à la base de données:",
      err.message
    );
  } else {
    console.log("Connecté à la base de données SQLite.");
  }
});

/**
 * Initialise la base de données en créant la table user_stats si elle n'existe pas.
 */
function initializeDatabase() {
  db.serialize(() => {
    db.run(
      `
      CREATE TABLE IF NOT EXISTS user_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE,
        username TEXT,
        n_word_count INTEGER DEFAULT 0
      )
    `,
      (err) => {
        if (err) {
          console.error(
            "Erreur lors de la création de la table user_stats:",
            err.message
          );
        } else {
          console.log("Table user_stats créée ou déjà existante.");
        }
      }
    );
  });
}

/**
 * Incrémente le compteur du n-word pour un utilisateur.
 * Si l'utilisateur n'existe pas dans la base, il est créé.
 *
 * @param {string} userId L'ID Discord de l'utilisateur
 * @param {string} username Le nom d'utilisateur
 * @param {number} [increment=1] La valeur d'incrémentation (par défaut 1)
 * @returns {Promise<void>}
 */
function incrementUserCount(userId, username, increment = 1) {
  return new Promise((resolve, reject) => {
    // Utilisation d'un UPSERT pour insérer ou mettre à jour le compteur
    db.run(
      `
      INSERT INTO user_stats (user_id, username, n_word_count)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET n_word_count = n_word_count + ?
      `,
      [userId, username, increment, increment],
      function (err) {
        if (err) {
          console.error(
            "Erreur lors de l'incrémentation du compteur:",
            err.message
          );
          return reject(err);
        }
        resolve();
      }
    );
  });
}

/**
 * Récupère le leaderboard, c'est-à-dire la liste des utilisateurs triés par nombre de n-word détectés.
 *
 * @param {number} [limit=10] Le nombre maximum d'utilisateurs à retourner (par défaut 10)
 * @returns {Promise<Array>} Tableau d'objets contenant { user_id, username, n_word_count }
 */
function getLeaderboard(limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT user_id, username, n_word_count
      FROM user_stats
      ORDER BY n_word_count DESC
      LIMIT ?
      `,
      [limit],
      (err, rows) => {
        if (err) {
          console.error(
            "Erreur lors de la récupération du leaderboard:",
            err.message
          );
          return reject(err);
        }
        resolve(rows);
      }
    );
  });
}

module.exports = {
  initializeDatabase,
  incrementUserCount,
  getLeaderboard,
  db, // Export optionnel de la connexion, si besoin d'accès direct ailleurs
};
