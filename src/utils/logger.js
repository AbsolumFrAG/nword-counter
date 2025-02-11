// Définition des niveaux de log
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Niveau de log courant (par défaut DEBUG, donc tous les messages seront affichés)
let currentLogLevel = LOG_LEVELS.DEBUG;

/**
 * Retourne la date et l'heure actuelles au format ISO.
 * @returns {string} Timestamp au format ISO.
 */
function formatTimestamp() {
  return new Date().toISOString();
}

/**
 * Affiche un message en fonction du niveau de log.
 * @param {number} level Niveau du log.
 * @param {string} message Message à afficher.
 */
function log(level, message) {
  if (level < currentLogLevel) {
    return;
  }
  const timestamp = formatTimestamp();
  let levelLabel = "";
  switch (level) {
    case LOG_LEVELS.DEBUG:
      levelLabel = "[DEBUG]";
      break;
    case LOG_LEVELS.INFO:
      levelLabel = "[INFO]";
      break;
    case LOG_LEVELS.WARN:
      levelLabel = "[WARN]";
      break;
    case LOG_LEVELS.ERROR:
      levelLabel = "[ERROR]";
      break;
    default:
      levelLabel = "[LOG]";
  }
  console.log(`${timestamp} ${levelLabel} ${message}`);
}

/**
 * Définit le niveau de log courant.
 * @param {string|number} level Niveau de log (exemple: 'DEBUG', 'INFO', 0, 1, etc.)
 */
function setLogLevel(level) {
  if (typeof level === "string") {
    const levelUpper = level.toUpperCase();
    if (LOG_LEVELS[levelUpper] !== undefined) {
      currentLogLevel = LOG_LEVELS[levelUpper];
    } else {
      console.warn(`Niveau de log inconnu: ${level}. Niveau actuel inchangé.`);
    }
  } else if (typeof level === "number") {
    currentLogLevel = level;
  } else {
    console.warn(
      `Type de niveau de log invalide: ${level}. Niveau actuel inchangé.`
    );
  }
}

module.exports = {
  debug: (message) => log(LOG_LEVELS.DEBUG, message),
  info: (message) => log(LOG_LEVELS.INFO, message),
  warn: (message) => log(LOG_LEVELS.WARN, message),
  error: (message) => log(LOG_LEVELS.ERROR, message),
  setLogLevel,
  LOG_LEVELS,
};
