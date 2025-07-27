import { AudioService } from '../services/audioService';
import { DatabaseService } from '../services/databaseService';
import { BaseCommand } from './baseCommand';
import { ConnectCommand } from './connectCommand';
import { DisconnectCommand } from './disconnectCommand';
import { LeaderboardCommand } from './leaderboardCommand';
import { ResetCommand } from './resetCommand';
import { StatsCommand } from './statsCommand';

/**
 * Create and return all available commands
 */
export function createCommands(
    dbService: DatabaseService, 
    audioService: AudioService
): Map<string, BaseCommand> {
    const commands = new Map<string, BaseCommand>();

    // Initialize commands
    const connectCmd = new ConnectCommand(audioService);
    const disconnectCmd = new DisconnectCommand();
    const leaderboardCmd = new LeaderboardCommand(dbService);
    const statsCmd = new StatsCommand(dbService);
    const resetCmd = new ResetCommand(dbService);

    // Register commands
    commands.set(connectCmd.data.name, connectCmd);
    commands.set(disconnectCmd.data.name, disconnectCmd);
    commands.set(leaderboardCmd.data.name, leaderboardCmd);
    commands.set(statsCmd.data.name, statsCmd);
    commands.set(resetCmd.data.name, resetCmd);

    return commands;
}

// Export command classes for direct usage if needed
export {
    BaseCommand,
    ConnectCommand,
    DisconnectCommand,
    LeaderboardCommand, ResetCommand, StatsCommand
};
