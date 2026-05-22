import * as vscode from 'vscode';
import { localize } from '../i18n';
import * as path from 'path';
import * as fs from 'fs';
import { BackupManager } from '../modules/backupManager';

interface BackupFile {
  name: string;
  displayName: string;
  sizeKb: number;
  dateTime: string;
  isLatest: boolean;
}

export class BackupPanel {
  static currentPanel: BackupPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly backupManager: BackupManager;
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(backupManager: BackupManager) {
    if (BackupPanel.currentPanel) {
      BackupPanel.currentPanel.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'myTimeTraceBackups',
      localize('backup.panel.title', 'My Time Trace — Manage Backups'),
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    BackupPanel.currentPanel = new BackupPanel(panel, backupManager);
  }

  private constructor(panel: vscode.WebviewPanel, backupManager: BackupManager) {
    this.panel = panel;
    this.backupManager = backupManager;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.disposables,
    );

    this.setupFileWatcher();
    this.render();
  }

  refresh() {
    this.render();
  }

  // ─── File system watcher ─────────────────────────────────────────────────

  private setupFileWatcher() {
    this.fileWatcher?.dispose();
    const status = this.backupManager.getStatus();
    if (!status.destinationPath) { return; }

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(status.destinationPath), '*.sqlite'),
    );
    this.fileWatcher.onDidCreate(() => this.render(), null, this.disposables);
    this.fileWatcher.onDidDelete(() => this.render(), null, this.disposables);
    this.disposables.push(this.fileWatcher);
  }

  // ─── Message handler ─────────────────────────────────────────────────────

  private async handleMessage(msg: { command: string; fileName?: string; fileNames?: string[] }) {
    switch (msg.command) {
      case 'triggerBackup':
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'My Time Trace', cancellable: false },
          async (p) => {
            p.report({ message: localize('backup.progress.running', 'Running backup...') });
            await this.backupManager.triggerManualBackup();
          },
        );
        break;

      case 'openWizard':
        await this.backupManager.openConfigWizard();
        this.setupFileWatcher();
        this.render();
        break;

      case 'openFolder': {
        const status = this.backupManager.getStatus();
        if (status.destinationPath) {
          await vscode.env.openExternal(vscode.Uri.file(status.destinationPath));
        }
        break;
      }

      case 'deleteBackup':
        if (msg.fileName) {
          await this.deleteFile(msg.fileName);
        }
        break;

      case 'deleteSelected':
        if (msg.fileNames && msg.fileNames.length > 0) {
          await this.deleteSelected(msg.fileNames);
        }
        break;

      case 'restoreBackup':
        if (msg.fileName) {
          const status = this.backupManager.getStatus();
          const fullPath = path.join(status.destinationPath, msg.fileName);
          await this.backupManager.restoreFromBackup(fullPath);
        }
        break;
    }
  }

  // ─── Delete helpers ───────────────────────────────────────────────────────

  private async deleteFile(fileName: string) {
    const status = this.backupManager.getStatus();
    const fullPath = path.join(status.destinationPath, fileName);

    const deleteLabel = localize('backup.panel.delete', 'Delete');
    const confirm = await vscode.window.showWarningMessage(
      localize('backup.panel.deleteConfirm', 'Delete backup "{0}"?', fileName),
      { modal: true },
      deleteLabel,
    );
    if (confirm !== deleteLabel) { return; }

    try {
      await vscode.workspace.fs.delete(vscode.Uri.file(fullPath));

      const remaining = this.listBackupFiles(status.destinationPath);
      if (remaining.length < 3) {
        vscode.window.showInformationMessage(
          localize('backup.panel.belowMinimum', 'My Time Trace: You have only {0} backup(s). We recommend keeping at least 3.', String(remaining.length)),
        );
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(localize('backup.panel.deleteError', 'My Time Trace: Error deleting — {0}', err.message));
    }
    this.render();
  }

  private async deleteSelected(fileNames: string[]) {
    const status = this.backupManager.getStatus();
    const count = fileNames.length;

    const deleteLabel = localize('backup.panel.delete', 'Delete');
    const confirm = await vscode.window.showWarningMessage(
      localize('backup.panel.deleteSelectedConfirm', 'Delete {0} selected backup(s)?', String(count)),
      { modal: true },
      deleteLabel,
    );
    if (confirm !== deleteLabel) { return; }

    for (const name of fileNames) {
      try {
        await vscode.workspace.fs.delete(vscode.Uri.file(path.join(status.destinationPath, name)));
      } catch { /* ignore already-removed files */ }
    }
    this.render();
  }

  // ─── List backup files ────────────────────────────────────────────────────

  private listBackupFiles(destPath: string): BackupFile[] {
    if (!destPath || !fs.existsSync(destPath)) { return []; }

    const PATTERN = /^time_tracker_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:_\d+)?\.sqlite$/;

    let files: BackupFile[] = [];
    try {
      files = fs.readdirSync(destPath)
        .filter(name => name.endsWith('.sqlite'))
        .map(name => {
          const full = path.join(destPath, name);
          const stat = fs.statSync(full);
          const sizeKb = Math.round(stat.size / 1024);
          const m = name.match(PATTERN);
          let dateTime = '';
          if (m) {
            const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
            dateTime = d.toLocaleString();
          }
          return { name, displayName: name.replace('.sqlite', ''), sizeKb, dateTime, isLatest: false };
        })
        .sort((a, b) => b.name.localeCompare(a.name));

      if (files.length > 0) { files[0].isLatest = true; }
    } catch { /* inaccessible folder */ }

    return files;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  private render() {
    const status = this.backupManager.getStatus();
    const destPath = status.destinationPath;
    const files = this.listBackupFiles(destPath);
    const dbPath = (this.backupManager as any).databaseManager?.getDbPath?.() ?? '';

    this.panel.webview.html = this.buildHtml(status, files, dbPath);
  }

  private stateLabel(state: string): string {
    switch (state) {
      case 'active':  return `<span style="color:#4caf50">${escHtml(localize('backup.panel.state.active',   '● Active'))}</span>`;
      case 'paused':  return `<span style="color:#9e9e9e">${escHtml(localize('backup.panel.state.paused',   '⏸ Paused'))}</span>`;
      case 'failed':  return `<span style="color:#f44336">${escHtml(localize('backup.panel.state.failed',   '✕ Failed'))}</span>`;
      default:        return `<span style="color:#9e9e9e">${escHtml(localize('backup.panel.state.inactive', '● Inactive'))}</span>`;
    }
  }

  private buildHtml(status: ReturnType<BackupManager['getStatus']>, files: BackupFile[], dbPath: string): string {
    const isBacking = status.isBacking;
    const lastBackup = status.lastBackupAt
      ? new Date(status.lastBackupAt).toLocaleString()
      : '—';

    // ── Localized strings ──────────────────────────────────────────────────
    const loc = {
      pageTitle:           localize('backup.panel.pageTitle',                   'Manage Backups'),
      heading:             localize('backup.panel.heading',                     'Manage Backups — My Time Trace'),
      statusState:         localize('backup.panel.status.state',                'State'),
      statusLastBackup:    localize('backup.panel.status.lastBackup',           'Last backup'),
      statusNextBackup:    localize('backup.panel.status.nextBackup',           'Next backup'),
      statusTotal:         localize('backup.panel.status.total',                'Total backups'),
      statusLastError:     localize('backup.panel.status.lastError',            'Last error'),
      btnBackupNow:        localize('backup.panel.btn.backupNow',               'Backup Now'),
      btnBackingUp:        localize('backup.panel.btn.backingUp',               'Backing up...'),
      btnConfigure:        localize('backup.panel.btn.configure',               'Configure Backup'),
      btnOpenFolder:       localize('backup.panel.btn.openFolder',              'Open Folder'),
      btnDeleteSelected:   localize('backup.panel.btn.deleteSelected',          'Delete Selected'),
      btnDeleteSelectedN:  localize('backup.panel.btn.deleteSelectedCount',     'Delete Selected ({0})'),
      cloudRec:            localize('backup.panel.cloud.recommendation',        'Recommendation'),
      cloudTip:            localize('backup.panel.cloud.tip',                   'For greater security, sync your backup folder with a cloud service such as OneDrive, Google Drive, Dropbox, or another of your preference. This way your data is protected even in case of local disk failure.'),
      colFile:             localize('backup.panel.col.file',                    'File'),
      colDateTime:         localize('backup.panel.col.dateTime',                'Date / Time'),
      colSize:             localize('backup.panel.col.size',                    'Size'),
      colRestore:          localize('backup.panel.col.restore',                 'Restore'),
      colDelete:           localize('backup.panel.col.delete',                  'Delete'),
      badgeCurrent:        localize('backup.panel.badge.current',               '● current'),
      emptyMsg:            localize('backup.panel.empty',                       'No backups found. Click "Backup Now" to create the first one.'),
      btnRestoreTitle:     localize('backup.panel.btn.restore.title',           'Restore this backup'),
      btnDeleteTitle:      localize('backup.panel.btn.delete.title',            'Delete this backup'),
      footerManualRestore: localize('backup.panel.footer.manualRestore',        'Manual restore:'),
      footerDesc:          localize('backup.panel.footer.manualRestoreDesc',    'Close VS Code, replace the file below with the desired backup, and reopen.'),
      footerDbPath:        localize('backup.panel.footer.currentDbPath',        'Current database path:'),
    };
    // ─────────────────────────────────────────────────────────────────────

    const filesHtml = files.length === 0
      ? `<tr><td colspan="6" class="empty-msg">${escHtml(loc.emptyMsg)}</td></tr>`
      : files.map(f => `
          <tr>
            <td><input type="checkbox" class="row-check" data-name="${escHtml(f.name)}"></td>
            <td>${escHtml(f.displayName)}${f.isLatest ? ` <span class="badge">${escHtml(loc.badgeCurrent)}</span>` : ''}</td>
            <td>${escHtml(f.dateTime)}</td>
            <td>${f.sizeKb >= 1024 ? (f.sizeKb / 1024).toFixed(1) + ' MB' : f.sizeKb + ' KB'}</td>
            <td><button onclick="restoreFile('${escHtml(f.name)}')" title="${escHtml(loc.btnRestoreTitle)}">↩</button></td>
            <td><button onclick="deleteFile('${escHtml(f.name)}')" title="${escHtml(loc.btnDeleteTitle)}">🗑</button></td>
          </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="${escHtml(vscode.env.language)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(loc.pageTitle)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }

  html, body {
    height: 100%;
    margin: 0;
    overflow: hidden;
  }

  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
  }

  h2 { margin: 0 0 10px; flex-shrink: 0; }

  .status-block {
    display: flex; gap: 24px; flex-wrap: wrap;
    margin-bottom: 10px; padding: 10px 12px;
    background: var(--vscode-editorWidget-background);
    border-radius: 4px; flex-shrink: 0;
  }
  .status-item { display: flex; flex-direction: column; }
  .status-label { font-size: 11px; opacity: .7; margin-bottom: 2px; }

  .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; flex-shrink: 0; }

  button { padding: 4px 10px; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 3px; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button:disabled { opacity: .5; cursor: default; }

  .table-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--vscode-editorWidget-border, #333);
    border-radius: 4px;
    overflow: hidden;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  thead {
    display: table;
    width: 100%;
    table-layout: fixed;
    flex-shrink: 0;
    background: var(--vscode-editorWidget-background);
  }

  th {
    text-align: left; padding: 6px 8px;
    border-bottom: 2px solid var(--vscode-editorWidget-border, #333);
    font-size: 12px; opacity: .8;
  }

  tbody {
    display: block;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  tbody tr {
    display: table;
    width: 100%;
    table-layout: fixed;
  }

  td { padding: 5px 8px; border-bottom: 1px solid var(--vscode-editorWidget-border, #333); font-size: 13px; }

  th:nth-child(1), td:nth-child(1) { width: 40px; }
  th:nth-child(3), td:nth-child(3) { width: 165px; }
  th:nth-child(4), td:nth-child(4) { width: 80px; }
  th:nth-child(5), td:nth-child(5) { width: 80px; text-align: center; }
  th:nth-child(6), td:nth-child(6) { width: 72px; text-align: center; }

  .badge { font-size: 10px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 1px 5px; border-radius: 10px; }
  .empty-msg { text-align: center; padding: 24px; opacity: .7; }

  .cloud-tip {
    flex-shrink: 0;
    display: flex; align-items: flex-start; gap: 8px;
    margin-bottom: 8px; padding: 8px 12px;
    background: var(--vscode-editorInfo-background, rgba(0,120,212,0.08));
    border-left: 3px solid var(--vscode-editorInfo-foreground, #0078d4);
    border-radius: 0 4px 4px 0;
    font-size: 12px;
  }
  .cloud-tip-icon { font-size: 16px; line-height: 1.4; flex-shrink: 0; }

  .footer {
    flex-shrink: 0;
    margin-top: 8px; font-size: 12px; opacity: .7;
    border-top: 1px solid var(--vscode-editorWidget-border, #333);
    padding-top: 8px;
  }

  #deleteSelectedBtn:disabled { opacity: .4; }
</style>
</head>
<body>
<h2>${escHtml(loc.heading)}</h2>

<div class="status-block">
  <div class="status-item"><span class="status-label">${escHtml(loc.statusState)}</span>${this.stateLabel(status.state)}</div>
  <div class="status-item"><span class="status-label">${escHtml(loc.statusLastBackup)}</span>${escHtml(lastBackup)}</div>
  <div class="status-item"><span class="status-label">${escHtml(loc.statusNextBackup)}</span>${status.nextBackupAt ? escHtml(new Date(status.nextBackupAt).toLocaleString()) : '—'}</div>
  <div class="status-item"><span class="status-label">${escHtml(loc.statusTotal)}</span><span>${files.length}</span></div>
  ${status.lastError ? `<div class="status-item"><span class="status-label">${escHtml(loc.statusLastError)}</span><span style="color:#f44336;font-size:12px">${escHtml(status.lastError)}</span></div>` : ''}
</div>

<div class="actions">
  <button onclick="doBackup()" ${isBacking ? 'disabled' : ''}>${isBacking ? escHtml(loc.btnBackingUp) : escHtml(loc.btnBackupNow)}</button>
  <button onclick="openWizard()">${escHtml(loc.btnConfigure)}</button>
  <button onclick="openFolder()">${escHtml(loc.btnOpenFolder)}</button>
  <button id="deleteSelectedBtn" disabled onclick="deleteSelected()">${escHtml(loc.btnDeleteSelected)}</button>
</div>

<div class="cloud-tip">
  <span class="cloud-tip-icon">☁️</span>
  <span><strong>${escHtml(loc.cloudRec)}:</strong> ${escHtml(loc.cloudTip)}</span>
</div>

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th><input type="checkbox" id="selectAll" onclick="toggleAll(this)"></th>
        <th>${escHtml(loc.colFile)}</th>
        <th>${escHtml(loc.colDateTime)}</th>
        <th>${escHtml(loc.colSize)}</th>
        <th>${escHtml(loc.colRestore)}</th>
        <th>${escHtml(loc.colDelete)}</th>
      </tr>
    </thead>
    <tbody>${filesHtml}</tbody>
  </table>
</div>

<div class="footer">
  <strong>${escHtml(loc.footerManualRestore)}</strong> ${escHtml(loc.footerDesc)}<br>
  ${escHtml(loc.footerDbPath)} <code>${escHtml(dbPath)}</code>
</div>

<script>
const vscode = acquireVsCodeApi();
const _lblDeleteSelected = '${escHtml(loc.btnDeleteSelected)}';
const _lblDeleteSelectedN = '${escHtml(loc.btnDeleteSelectedN)}';

function doBackup() { vscode.postMessage({ command: 'triggerBackup' }); }
function openWizard() { vscode.postMessage({ command: 'openWizard' }); }
function openFolder() { vscode.postMessage({ command: 'openFolder' }); }
function deleteFile(name) { vscode.postMessage({ command: 'deleteBackup', fileName: name }); }
function restoreFile(name) { vscode.postMessage({ command: 'restoreBackup', fileName: name }); }

function toggleAll(cb) {
  document.querySelectorAll('.row-check').forEach(c => { c.checked = cb.checked; });
  updateDeleteBtn();
}

document.addEventListener('change', (e) => {
  if (e.target.classList.contains('row-check') || e.target.id === 'selectAll') { updateDeleteBtn(); }
});

function updateDeleteBtn() {
  const checked = [...document.querySelectorAll('.row-check:checked')];
  const btn = document.getElementById('deleteSelectedBtn');
  btn.disabled = checked.length === 0;
  btn.textContent = checked.length > 0
    ? _lblDeleteSelectedN.replace('{0}', checked.length)
    : _lblDeleteSelected;
}

function deleteSelected() {
  const names = [...document.querySelectorAll('.row-check:checked')].map(c => c.dataset.name);
  vscode.postMessage({ command: 'deleteSelected', fileNames: names });
}
</script>
</body>
</html>`;
  }

  // ─── Dispose ─────────────────────────────────────────────────────────────

  private dispose() {
    BackupPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

function escHtml(str: string): string {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
