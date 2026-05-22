import * as vscode from 'vscode';
import { localize } from '../i18n';
import { CommandManager } from './commands';
import { BackupManager } from './backupManager';
import { BackupPanel } from '../ui/backupPanel';

export class BackupCommands {
  static registerBackupCommands(
    _context: vscode.ExtensionContext,
    getBackupManager: () => BackupManager | undefined,
  ): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    const notReady = () => {
      vscode.window.showInformationMessage(
        localize('backup.notReady', 'My Time Trace: Backup system is still initializing. Please try again in a moment.'),
      );
    };

    disposables.push(
      CommandManager.safeRegisterCommand('my-time-trace-vscode.backupNow', async () => {
        const mgr = getBackupManager();
        if (!mgr) { notReady(); return; }
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'MyTimeTrace',
            cancellable: false,
          },
          async (progress) => {
            progress.report({ message: localize('backup.progress.running', 'Running backup...') });
            await mgr.triggerManualBackup();
          },
        );
      }),
    );

    disposables.push(
      CommandManager.safeRegisterCommand('my-time-trace-vscode.configureBackup', async () => {
        const mgr = getBackupManager();
        if (!mgr) { notReady(); return; }
        await mgr.openConfigWizard();
      }),
    );

    disposables.push(
      CommandManager.safeRegisterCommand('my-time-trace-vscode.manageBackups', () => {
        const mgr = getBackupManager();
        if (!mgr) { notReady(); return; }
        BackupPanel.createOrShow(mgr);
      }),
    );

    disposables.push(
      CommandManager.safeRegisterCommand('my-time-trace-vscode.openBackupFolder', async () => {
        const mgr = getBackupManager();
        if (!mgr) { notReady(); return; }
        const status = mgr.getStatus();
        if (!status.destinationPath) {
          vscode.window.showInformationMessage(
            localize('backup.openFolder.notConfigured', 'My Time Trace: No backup folder configured. Run "My Time Trace: Configure Backup" first.'),
          );
          return;
        }
        await vscode.env.openExternal(vscode.Uri.file(status.destinationPath));
      }),
    );

    disposables.push(
      CommandManager.safeRegisterCommand('my-time-trace-vscode.editBackupSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'myTimeTraceVSCode.backup');
      }),
    );

    disposables.push(
      CommandManager.safeRegisterCommand('my-time-trace-vscode.pauseBackup', async () => {
        const mgr = getBackupManager();
        if (!mgr) { notReady(); return; }
        mgr.pauseScheduler();
        const cfg = vscode.workspace.getConfiguration('myTimeTraceVSCode.backup');
        await cfg.update('enabled', false, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(localize('backup.paused', 'My Time Trace: Automatic backup paused.'));
      }),
    );

    disposables.push(
      CommandManager.safeRegisterCommand('my-time-trace-vscode.resumeBackup', async () => {
        const mgr = getBackupManager();
        if (!mgr) { notReady(); return; }
        const cfg = vscode.workspace.getConfiguration('myTimeTraceVSCode.backup');
        await cfg.update('enabled', true, vscode.ConfigurationTarget.Global);
        await mgr.initialize();
        vscode.window.showInformationMessage(localize('backup.resumed', 'My Time Trace: Automatic backup resumed.'));
      }),
    );

    return disposables;
  }
}
