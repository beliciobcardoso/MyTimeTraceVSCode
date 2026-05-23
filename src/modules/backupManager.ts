import * as vscode from 'vscode';
import { localize } from '../i18n';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as sqlite3 from 'sqlite3';
import { DatabaseManager } from './database';
import { timeTrace } from './timeTrace';

import {
  BACKUP_MIN_RETENTION,
  BACKUP_ALERT_GAP_DAYS,
} from '../config/constants';
import { BackupRetryManager } from './backupRetryManager';

export type BackupState = 'active' | 'paused' | 'failed' | 'idle';

interface PragmaQuickCheckRow { quick_check: string; }

export interface BackupStatus {
  state: BackupState;
  isBacking: boolean;
  lastBackupAt: string | null;
  nextBackupAt: string | null;
  lastError: string | null;
  destinationPath: string;
}

// Importação lazy para evitar dependência circular no momento do carregamento
let BackupPanelRef: { currentPanel?: { refresh(): void } } | null = null;
export function setBackupPanelRef(ref: { currentPanel?: { refresh(): void } }) {
  BackupPanelRef = ref;
}

export class BackupManager {
  private isBackingUp = false;
  private state: BackupState = 'idle';
  private lastBackupAt: string | null = null;
  private nextBackupAt: string | null = null;
  private lastError: string | null = null;
  private readonly retryManager = new BackupRetryManager();

  // Timers do agendador (Fase 2)
  private scheduleTimeout: NodeJS.Timeout | undefined;
  private scheduleInterval: NodeJS.Timeout | undefined;
  private configDebounceTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly databaseManager: DatabaseManager,
    private readonly myTimeTrace: timeTrace,
    private readonly outputChannel: vscode.OutputChannel,
  ) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private log(msg: string) {
    this.outputChannel.appendLine(`[BackupManager] ${msg}`);
  }

  private expandPath(p: string): string {
    if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
      return path.join(os.homedir(), p.slice(1));
    }
    return p;
  }

  private contractPath(p: string): string {
    const home = os.homedir();
    if (p === home) { return '~'; }
    if (p.startsWith(home + path.sep)) {
      return '~' + p.slice(home.length);
    }
    return p;
  }

  private getConfig() {
    const cfg = vscode.workspace.getConfiguration('myTimeTraceVSCode.backup');
    return {
      enabled: cfg.get<boolean>('enabled', false),
      destinationPath: this.expandPath(cfg.get<string>('destinationPath', '').trim()),
      intervalHours: Math.max(1, cfg.get<number>('intervalHours', 24) || 1),
      maxBackups: Math.max(BACKUP_MIN_RETENTION, cfg.get<number>('maxBackups', 7) || BACKUP_MIN_RETENTION),
      notifyOnSuccess: cfg.get<boolean>('notifyOnSuccess', false),
    };
  }

  // ─── Path validation ─────────────────────────────────────────────────────

  private validateDestinationPath(destPath: string): string | null {
    if (!destPath) { return localize('backup.error.noDestination', 'Backup destination folder not configured.'); }
    if (!path.isAbsolute(destPath)) { return localize('backup.error.notAbsolute', 'Backup destination path must be absolute.'); }
    if (destPath.includes("'")) { return localize('backup.error.singleQuote', "Backup destination path cannot contain single quotes."); }
    if (destPath.includes('\0')) { return localize('backup.error.nullByte', 'Backup destination path contains invalid characters.'); }
    if (destPath.split(/[\\/]/).some(seg => seg === '..')) { return localize('backup.error.pathTraversal', 'Backup destination path cannot contain traversal components (..); use an absolute path.'); }
    return null;
  }

  // ─── Backup file naming ───────────────────────────────────────────────────

  private formatBackupName(date: Date, suffix = 0): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = date.getUTCFullYear();
    const mo = pad(date.getUTCMonth() + 1);
    const d = pad(date.getUTCDate());
    const h = pad(date.getUTCHours());
    const mi = pad(date.getUTCMinutes());
    const s = pad(date.getUTCSeconds());
    const base = `time_tracker_${y}-${mo}-${d}_${h}-${mi}-${s}`;
    return suffix > 0 ? `${base}_${suffix}.sqlite` : `${base}.sqlite`;
  }

  /** Resolve nome sem colisão: adiciona _1, _2 se necessário */
  private async resolveFileName(destPath: string, date: Date): Promise<string> {
    let suffix = 0;
    while (true) {
      const name = this.formatBackupName(date, suffix);
      const full = path.join(destPath, name);
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(full));
        suffix++;
      } catch {
        return name;
      }
    }
  }

  // ─── Retention policy ────────────────────────────────────────────────────

  private parseBackupTimestamp(fileName: string): Date | null {
    // Matches: time_tracker_YYYY-MM-DD_HH-mm-ss[_N].sqlite
    const m = fileName.match(
      /^time_tracker_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:_\d+)?\.sqlite$/,
    );
    if (!m) { return null; }
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  }

  private async applyRetentionPolicy(destPath: string, maxBackups: number): Promise<void> {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(destPath));
    } catch {
      return;
    }

    const backups = entries
      .filter(([name, type]) => type === vscode.FileType.File && this.parseBackupTimestamp(name) !== null)
      .map(([name]) => ({ name, ts: this.parseBackupTimestamp(name)! }))
      .sort((a, b) => b.ts.getTime() - a.ts.getTime()); // mais recente primeiro

    const toRemove = backups.slice(maxBackups);
    for (const item of toRemove) {
      try {
        await vscode.workspace.fs.delete(vscode.Uri.file(path.join(destPath, item.name)));
        this.log(`Retenção: removido ${item.name}`);
      } catch {
        // Arquivo já removido por outra janela — ignorar
      }
    }
  }

  // ─── Orphan cleanup ───────────────────────────────────────────────────────

  private async cleanOrphans(destPath: string): Promise<void> {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(destPath));
    } catch {
      return;
    }
    for (const [name, type] of entries) {
      if (type === vscode.FileType.File && name.endsWith('.sqlite.tmp')) {
        try {
          await vscode.workspace.fs.delete(vscode.Uri.file(path.join(destPath, name)));
          this.log(`Limpeza: órfão removido ${name}`);
        } catch { /* ignorar */ }
      }
    }
  }

  // ─── Disk space check ─────────────────────────────────────────────────────

  private async checkDiskSpace(dbPath: string, destPath: string): Promise<boolean> {
    try {
      const statDb = fs.statSync(dbPath);
      const dbSize = statDb.size;
      // statfs disponível a partir do Node 16.x
      if (typeof (fs.promises as any).statfs === 'function') {
        const info = await (fs.promises as any).statfs(destPath);
        const available = info.bavail * info.bsize;
        const required = dbSize * 1.5;
        if (available < required) {
          const availMB = (available / 1024 / 1024).toFixed(1);
          const reqMB = (required / 1024 / 1024).toFixed(1);
          throw new Error(`Espaço insuficiente: disponível ${availMB} MB, necessário ${reqMB} MB`);
        }
      }
      return true;
    } catch (err: any) {
      if (err.message?.startsWith('Espaço insuficiente')) { throw err; }
      // statfs não disponível ou destino ainda não existe — prosseguir
      return true;
    }
  }

  // ─── Validate backup file ─────────────────────────────────────────────────

  validateBackupFile(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const testDb = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) => {
        if (err) { return reject(new Error(`Não foi possível abrir backup para verificação: ${err.message}`)); }
        testDb.get('PRAGMA quick_check', (qErr, row: PragmaQuickCheckRow) => {
          testDb.close((_closeErr) => {
            if (qErr) { return reject(new Error(`PRAGMA quick_check falhou no backup: ${qErr.message}`)); }
            if (!row || row.quick_check !== 'ok') {
              return reject(new Error(`Backup corrompido: ${JSON.stringify(row)}`));
            }
            resolve();
          });
        });
      });
    });
  }

  // ─── Sync metadata helpers ────────────────────────────────────────────────

  private async persistMetadata(key: string, value: string): Promise<void> {
    try {
      await this.databaseManager.setMetadata(key, value);
    } catch {
      // Falha silenciosa — banco pode não estar pronto
    }
  }

  private async getMetadata(key: string): Promise<string | null> {
    try {
      return await this.databaseManager.getMetadata(key);
    } catch {
      return null;
    }
  }

  // ─── Error handling ───────────────────────────────────────────────────────

  private async handleBackupError(err: unknown): Promise<void> {
    const msg = err instanceof Error ? err.message : String(err);
    this.lastError = msg;
    this.state = 'failed';
    this.log(`ERRO: ${msg}`);
    await this.persistMetadata('backup.lastError', msg);
    await this.persistMetadata('backup.state', 'failed');
    vscode.window.showErrorMessage(localize('backup.error.generic', 'MyTimeTrace Backup: {0}', msg));
    BackupPanelRef?.currentPanel?.refresh();
  }

  // ─── Core backup ─────────────────────────────────────────────────────────

  private async performBackup(): Promise<void> {
    if (this.isBackingUp) {
      vscode.window.showInformationMessage(localize('backup.alreadyRunning', 'My Time Trace: Backup already in progress.'));
      return;
    }
    this.isBackingUp = true;
    BackupPanelRef?.currentPanel?.refresh();

    const { destinationPath, maxBackups } = this.getConfig();
    const dbPath = this.databaseManager.getDbPath();

    try {
      this.log('Iniciando backup...');

      // Validação do path de destino
      const pathError = this.validateDestinationPath(destinationPath);
      if (pathError) { throw new Error(pathError); }

      // PRAGMA quick_check na origem
      await this.databaseManager.checkIntegrity();

      // Criar pasta de destino se necessário
      if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, { recursive: true });
        this.log(`Pasta de destino criada: ${destinationPath}`);
      }

      // Limpeza de órfãos .tmp
      await this.cleanOrphans(destinationPath);

      // Verificar espaço em disco
      await this.checkDiskSpace(dbPath, destinationPath);

      // Resolver nome sem colisão
      const now = new Date();
      const fileName = await this.resolveFileName(destinationPath, now);
      const tmpPath = path.join(destinationPath, fileName + '.tmp');
      const finalPath = path.join(destinationPath, fileName);

      this.log(`Criando backup: ${fileName}`);

      // VACUUM INTO para arquivo .tmp (path forward-slashes mesmo no Windows)
      const vacuumPath = tmpPath.replace(/\\/g, '/');
      await this.databaseManager.vacuumInto(vacuumPath);

      // Rename atômico .tmp → .sqlite
      await vscode.workspace.fs.rename(
        vscode.Uri.file(tmpPath),
        vscode.Uri.file(finalPath),
        { overwrite: false },
      );

      // Validar integridade do backup
      try {
        await this.validateBackupFile(finalPath);
      } catch (valErr) {
        // Remover arquivo corrompido
        try { await vscode.workspace.fs.delete(vscode.Uri.file(finalPath)); } catch { /* ignorar */ }
        throw valErr;
      }

      // Persistir metadados
      const tsNow = now.toISOString();
      this.lastBackupAt = tsNow;
      this.state = 'active';
      this.lastError = null;
      await this.persistMetadata('backup.lastTimestamp', tsNow);
      await this.persistMetadata('backup.state', 'active');
      await this.persistMetadata('backup.lastError', '');

      this.log(`Backup concluído: ${fileName}`);

      // Política de retenção
      await this.applyRetentionPolicy(destinationPath, maxBackups);

      // Notificar painel
      BackupPanelRef?.currentPanel?.refresh();

      const { notifyOnSuccess } = this.getConfig();
      if (notifyOnSuccess) {
        vscode.window.showInformationMessage(localize('backup.success', 'My Time Trace: Backup complete — {0}', fileName));
      }
    } catch (err) {
      await this.handleBackupError(err);
    } finally {
      this.isBackingUp = false;
      BackupPanelRef?.currentPanel?.refresh();
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  async triggerManualBackup(): Promise<void> {
    await this.retryManager.execute(() => this.performBackup());
  }

  getStatus(): BackupStatus {
    const { destinationPath } = this.getConfig();
    return {
      state: this.state,
      isBacking: this.isBackingUp,
      lastBackupAt: this.lastBackupAt,
      nextBackupAt: this.nextBackupAt,
      lastError: this.lastError,
      destinationPath,
    };
  }

  // ─── Wizard ───────────────────────────────────────────────────────────────

  async openConfigWizard(): Promise<void> {
    // Passo 1: Pasta de destino
    const folderUri = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: localize('backup.wizard.selectFolder', 'Select Backup Folder'),
      title: localize('backup.wizard.step1.title', 'MyTimeTrace Backup — Step 1/4: Destination Folder'),
    });
    if (!folderUri || folderUri.length === 0) { return; } // Esc → abortar

    const destPath = this.contractPath(folderUri[0].fsPath);

    // Aviso para pastas de nuvem/rede
    const cloudPatterns = ['dropbox', 'onedrive', 'google drive', 'gdrive', 'icloud', 'nextcloud'];
    const lowerPath = destPath.toLowerCase();
    if (cloudPatterns.some(p => lowerPath.includes(p)) || destPath.startsWith('\\\\') || destPath.startsWith('//')) {
      const cont = await vscode.window.showWarningMessage(
        localize('backup.wizard.cloudWarning', 'The selected folder appears to be a cloud or network location. This may cause corruption during backup. Continue anyway?'),
        localize('backup.wizard.continue', 'Continue'),
        localize('backup.wizard.cancel', 'Cancel'),
      );
      if (cont !== localize('backup.wizard.continue', 'Continue')) { return; }
    }

    // Passo 2: Intervalo
    const customLabel = localize('backup.wizard.intervalCustom', 'Custom');
    const intervalOptions = ['1h', '4h', '8h', '12h', '24h', customLabel];
    const intervalPick = await vscode.window.showQuickPick(intervalOptions, {
      title: localize('backup.wizard.step2.title', 'MyTimeTrace Backup — Step 2/4: Backup Interval'),
      placeHolder: localize('backup.wizard.step2.placeholder', 'Select the interval between automatic backups'),
    });
    if (!intervalPick) { return; }

    let intervalHours = 24;
    if (intervalPick === customLabel) {
      const custom = await vscode.window.showInputBox({
        title: localize('backup.wizard.customInterval.title', 'MyTimeTrace Backup — Custom Interval'),
        prompt: localize('backup.wizard.customInterval.prompt', 'Enter interval in hours (minimum: 1)'),
        validateInput: (v) => {
          const n = Number(v);
          if (!v || isNaN(n) || n < 1) { return localize('backup.wizard.customInterval.error', 'Enter a number greater than 0'); }
          return null;
        },
      });
      if (!custom) { return; }
      intervalHours = Math.max(1, Number(custom));
    } else {
      intervalHours = parseInt(intervalPick);
    }

    // Passo 3: Retenção máxima
    const retentionStr = await vscode.window.showInputBox({
      title: localize('backup.wizard.step3.title', 'MyTimeTrace Backup — Step 3/4: Maximum Retention'),
      prompt: localize('backup.wizard.step3.prompt', 'Maximum number of backups to keep (minimum: {0})', String(BACKUP_MIN_RETENTION)),
      value: '7',
      validateInput: (v) => {
        const n = Number(v);
        if (!v || isNaN(n) || n < BACKUP_MIN_RETENTION) { return localize('backup.wizard.step3.error', 'Minimum: {0}', String(BACKUP_MIN_RETENTION)); }
        return null;
      },
    });
    if (!retentionStr) { return; }
    const maxBackups = Math.max(BACKUP_MIN_RETENTION, Number(retentionStr));

    // Passo 4: Resumo e confirmação
    const confirmLabel = localize('backup.wizard.step4.confirm', 'Confirm and Create First Backup');
    const cancelLabel = localize('backup.wizard.cancel', 'Cancel');
    const confirm = await vscode.window.showQuickPick([confirmLabel, cancelLabel], {
      title: localize('backup.wizard.step4.title', 'MyTimeTrace Backup — Step 4/4: Confirmation'),
      placeHolder: localize('backup.wizard.step4.summary', 'Folder: {0} | Every {1}h | Keep {2} backups', destPath, String(intervalHours), String(maxBackups)),
    });
    if (!confirm || confirm === cancelLabel) { return; }

    // Salvar configurações
    const cfg = vscode.workspace.getConfiguration('myTimeTraceVSCode.backup');
    await cfg.update('destinationPath', destPath, vscode.ConfigurationTarget.Global);
    await cfg.update('intervalHours', intervalHours, vscode.ConfigurationTarget.Global);
    await cfg.update('maxBackups', maxBackups, vscode.ConfigurationTarget.Global);
    await cfg.update('enabled', true, vscode.ConfigurationTarget.Global);

    // Primeiro backup imediato
    await this.triggerManualBackup();
  }

  // ─── Scheduler (Fase 2) ───────────────────────────────────────────────────

  scheduleNext(intervalMs: number): void {
    this.clearSchedule();

    const lastTs = this.lastBackupAt ? new Date(this.lastBackupAt).getTime() : 0;
    const now = Date.now();
    const elapsed = now - lastTs;
    const firstDelay = Math.max(0, intervalMs - elapsed);

    this.nextBackupAt = new Date(now + firstDelay).toISOString();
    this.state = 'active';
    this.persistMetadata('backup.nextScheduled', this.nextBackupAt).catch(() => {});
    this.persistMetadata('backup.state', 'active').catch(() => {});
    BackupPanelRef?.currentPanel?.refresh();

    this.scheduleTimeout = setTimeout(async () => {
      await this.performBackup();
      this.scheduleInterval = setInterval(async () => {
        await this.performBackup();
      }, intervalMs);
    }, firstDelay);

    this.log(`Próximo backup agendado em ${Math.round(firstDelay / 60000)} min`);
  }

  private clearSchedule(): void {
    if (this.scheduleTimeout) { clearTimeout(this.scheduleTimeout); this.scheduleTimeout = undefined; }
    if (this.scheduleInterval) { clearInterval(this.scheduleInterval); this.scheduleInterval = undefined; }
  }

  async checkMissedBackup(): Promise<void> {
    const { enabled, intervalHours } = this.getConfig();
    if (!enabled) { return; }

    const lastTs = await this.getMetadata('backup.lastTimestamp');
    if (!lastTs) { return; }

    const lastDate = new Date(lastTs);
    const gapMs = Date.now() - lastDate.getTime();
    const intervalMs = intervalHours * 3600_000;

    if (gapMs > intervalMs) {
      this.log(`Gap de ${Math.round(gapMs / 3600000)}h detectado — executando backup atrasado`);
      await this.performBackup();

      // Alerta de gap prolongado
      const gapDays = gapMs / 86_400_000;
      if (gapDays > BACKUP_ALERT_GAP_DAYS) {
        vscode.window.showWarningMessage(
          localize('backup.gapAlert', 'My Time Trace: The last backup was {0} days ago. A backup has been performed now.', String(Math.round(gapDays))),
        );
      }
    }
  }

  onConfigChange(): void {
    if (this.configDebounceTimer) { clearTimeout(this.configDebounceTimer); }
    this.configDebounceTimer = setTimeout(() => {
      const { enabled, intervalHours } = this.getConfig();
      if (enabled) {
        this.scheduleNext(intervalHours * 3600_000);
      } else {
        this.pauseScheduler();
      }
    }, 500);
  }

  pauseScheduler(): void {
    this.clearSchedule();
    this.state = 'paused';
    this.nextBackupAt = null;
    this.persistMetadata('backup.state', 'paused').catch(() => {});
    this.log('Agendamento pausado');
    BackupPanelRef?.currentPanel?.refresh();
  }

  async initialize(): Promise<void> {
    const { enabled, intervalHours } = this.getConfig();
    if (!enabled) { return; }

    const lastTs = await this.getMetadata('backup.lastTimestamp');
    if (lastTs) { this.lastBackupAt = lastTs; }

    await this.checkMissedBackup();
    this.scheduleNext(intervalHours * 3600_000);
  }

  // ─── Restore (Fase 2) ─────────────────────────────────────────────────────

  async restoreFromBackup(backupFilePath: string): Promise<void> {
    const restoreLabel = localize('backup.restore.confirm', 'Restore');
    const answer = await vscode.window.showWarningMessage(
      localize('backup.restore.warning', 'This will replace the current database with the selected backup and restart VS Code. Continue?'),
      { modal: true },
      restoreLabel,
    );
    if (answer !== restoreLabel) { return; }

    this.pauseScheduler();

    try {
      this.myTimeTrace.pauseTracking();
    } catch { /* ignorar */ }

    const dbPath = this.databaseManager.getDbPath();

    try {
      await this.databaseManager.close();
    } catch { /* ignorar */ }

    try {
      await vscode.workspace.fs.copy(
        vscode.Uri.file(backupFilePath),
        vscode.Uri.file(dbPath),
        { overwrite: true },
      );
      this.log(`Restaurado de ${backupFilePath}`);
    } catch (err: any) {
      vscode.window.showErrorMessage(localize('backup.restore.error', 'My Time Trace: Error restoring backup — {0}', err.message));
      return;
    }

    vscode.commands.executeCommand('workbench.action.reloadWindow');
  }

  // ─── Dispose ─────────────────────────────────────────────────────────────

  dispose(): void {
    this.clearSchedule();
    if (this.configDebounceTimer) { clearTimeout(this.configDebounceTimer); }
    try { this.log('BackupManager encerrado'); } catch { /* canal já fechado */ }
  }
}
