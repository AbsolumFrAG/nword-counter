const { Pool } = require("pg");
const logger = require("./logger");

// Configuration de la connexion PostgreSQL
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT || 5432,
});

// Test de la connexion
pool.connect((err, client, release) => {
  if (err) {
    logger.error("Erreur lors de la connexion à PostgreSQL:", err.message);
  } else {
    logger.info("Connecté à PostgreSQL avec succès");
    release();
  }
});

/**
 * Initialise la base de données en créant la table user_stats si elle n'existe pas.
 */
async function initializeDatabase() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS user_stats (
        id SERIAL PRIMARY KEY,
        user_id TEXT UNIQUE,
        username TEXT,
        n_word_count INTEGER DEFAULT 0
      )
    `;
    await pool.query(createTableQuery);
    logger.info("Table user_stats créée ou déjà existante.");
  } catch (err) {
    logger.error(
      "Erreur lors de la création de la table user_stats:",
      err.message
    );
    throw err;
  }
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
async function incrementUserCount(userId, username, increment = 1) {
  try {
    const upsertQuery = `
      INSERT INTO user_stats (user_id, username, n_word_count)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) 
      DO UPDATE SET n_word_count = user_stats.n_word_count + $3
    `;
    await pool.query(upsertQuery, [userId, username, increment]);
    logger.info(
      `Compteur incrémenté pour l'utilisateur ${username} (${userId})`
    );
  } catch (err) {
    logger.error("Erreur lors de l'incrémentation du compteur:", err.message);
    throw err;
  }
}

/**
 * Récupère le leaderboard, c'est-à-dire la liste des utilisateurs triés par nombre de n-word détectés.
 *
 * @param {number} [limit=10] Le nombre maximum d'utilisateurs à retourner (par défaut 10)
 * @returns {Promise<Array>} Tableau d'objets contenant { user_id, username, n_word_count }
 */
async function getLeaderboard(limit = 10) {
  try {
    const query = `
      SELECT user_id, username, n_word_count
      FROM user_stats
      ORDER BY n_word_count DESC
      LIMIT $1
    `;
    const { rows } = await pool.query(query, [limit]);
    return rows;
  } catch (err) {
    logger.error("Erreur lors de la récupération du leaderboard:", err.message);
    throw err;
  }
}

/**
 * Ferme proprement la connexion à la base de données
 */
async function closeConnection() {
  try {
    await pool.end();
    logger.info("Connexion à la base de données fermée");
  } catch (err) {
    logger.error("Erreur lors de la fermeture de la connexion:", err.message);
    throw err;
  }
}

module.exports = {
  initializeDatabase,
  incrementUserCount,
  getLeaderboard,
  closeConnection,
  pool, // Export du pool pour des cas d'utilisation spécifiques
};
