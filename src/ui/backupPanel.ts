import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as path from 'path';
import * as fs from 'fs';
import { BackupManager } from '../modules/backupManager';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

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
      'My Time Trace — Gerenciar Backups',
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
          { location: vscode.ProgressLocation.Notification, title: 'MyTimeTrace', cancellable: false },
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

      // Avisar se abaixo do mínimo de retenção
      const remaining = this.listBackupFiles(status.destinationPath);
      if (remaining.length < 3) {
        vscode.window.showInformationMessage(
          localize('backup.panel.belowMinimum', 'My Time Trace: You have only {0} backup(s). We recommend keeping at least 3.', String(remaining.length)),
        );
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(localize('backup.panel.deleteError', 'MyTimeTrace: Error deleting — {0}', err.message));
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
      } catch { /* ignorar arquivos já removidos */ }
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
    } catch { /* pasta inacessível */ }

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
      case 'active': return '<span style="color:#4caf50">● Ativo</span>';
      case 'paused': return '<span style="color:#9e9e9e">⏸ Pausado</span>';
      case 'failed': return '<span style="color:#f44336">✕ Falha</span>';
      default: return '<span style="color:#9e9e9e">● Inativo</span>';
    }
  }

  private buildHtml(status: ReturnType<BackupManager['getStatus']>, files: BackupFile[], dbPath: string): string {
    const isBacking = status.isBacking;
    const lastBackup = status.lastBackupAt
      ? new Date(status.lastBackupAt).toLocaleString()
      : '—';

    const filesHtml = files.length === 0
      ? `<tr><td colspan="6" class="empty-msg">Nenhum backup encontrado. Clique em "Fazer Backup Agora" para criar o primeiro.</td></tr>`
      : files.map(f => `
          <tr>
            <td><input type="checkbox" class="row-check" data-name="${escHtml(f.name)}"></td>
            <td>${escHtml(f.displayName)}${f.isLatest ? ' <span class="badge">● atual</span>' : ''}</td>
            <td>${escHtml(f.dateTime)}</td>
            <td>${f.sizeKb >= 1024 ? (f.sizeKb / 1024).toFixed(1) + ' MB' : f.sizeKb + ' KB'}</td>
            <td><button onclick="restoreFile('${escHtml(f.name)}')" title="Restaurar este backup">↩</button></td>
            <td><button onclick="deleteFile('${escHtml(f.name)}')" title="Excluir este backup">🗑</button></td>
          </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Gerenciar Backups</title>
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

  /* ── Wrapper que ocupa todo o espaço restante ── */
  .table-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--vscode-editorWidget-border, #333);
    border-radius: 4px;
    overflow: hidden;
  }

  /* ── Tabela como flex column para separar thead (fixo) de tbody (scroll) ── */
  table {
    width: 100%;
    border-collapse: collapse;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  /* thead permanece fixo no topo */
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

  /* tbody rola verticalmente ocupando o restante */
  tbody {
    display: block;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  /* cada linha do tbody precisa replicar o contexto de tabela */
  tbody tr {
    display: table;
    width: 100%;
    table-layout: fixed;
  }

  td { padding: 5px 8px; border-bottom: 1px solid var(--vscode-editorWidget-border, #333); font-size: 13px; }

  /* larguras explícitas — obrigatórias para alinhar thead e tbody */
  th:nth-child(1), td:nth-child(1) { width: 40px; }
  th:nth-child(3), td:nth-child(3) { width: 165px; }
  th:nth-child(4), td:nth-child(4) { width: 80px; }
  th:nth-child(5), td:nth-child(5) { width: 80px; text-align: center; }
  th:nth-child(6), td:nth-child(6) { width: 72px; text-align: center; }
  /* coluna 2 (Arquivo) ocupa o restante automaticamente */

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
  .cloud-tip a { color: var(--vscode-textLink-foreground, #4da3ff); text-decoration: none; }
  .cloud-tip a:hover { text-decoration: underline; }

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
<h2>Gerenciar Backups — MyTimeTrace</h2>

<div class="status-block">
  <div class="status-item"><span class="status-label">Estado</span>${this.stateLabel(status.state)}</div>
  <div class="status-item"><span class="status-label">Último backup</span>${escHtml(lastBackup)}</div>
  <div class="status-item"><span class="status-label">Próximo backup</span>${status.nextBackupAt ? escHtml(new Date(status.nextBackupAt).toLocaleString()) : '—'}</div>
  <div class="status-item"><span class="status-label">Total de backups</span><span>${files.length}</span></div>
  ${status.lastError ? `<div class="status-item"><span class="status-label">Último erro</span><span style="color:#f44336;font-size:12px">${escHtml(status.lastError)}</span></div>` : ''}
</div>

<div class="actions">
  <button onclick="doBackup()" ${isBacking ? 'disabled' : ''}>${isBacking ? 'Fazendo backup...' : 'Fazer Backup Agora'}</button>
  <button onclick="openWizard()">Configurar Backup</button>
  <button onclick="openFolder()">Abrir Pasta</button>
  <button id="deleteSelectedBtn" disabled onclick="deleteSelected()">Excluir Selecionados</button>
</div>

<div class="cloud-tip">
  <span class="cloud-tip-icon">☁️</span>
  <span>
    <strong>Recomendação:</strong> Para maior segurança, sincronize sua pasta de backups com um serviço de nuvem
    como <strong>OneDrive</strong>, <strong>Google Drive</strong>, <strong>Dropbox</strong> ou outro de sua preferência.
    Assim seus dados ficam protegidos mesmo em caso de falha no disco local.
  </span>
</div>

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th><input type="checkbox" id="selectAll" onclick="toggleAll(this)"></th>
        <th>Arquivo</th>
        <th>Data / Hora</th>
        <th>Tamanho</th>
        <th>Restaurar</th>
        <th>Excluir</th>
      </tr>
    </thead>
    <tbody>${filesHtml}</tbody>
  </table>
</div>

<div class="footer">
  <strong>Restauração manual:</strong> Feche o VS Code, substitua o arquivo abaixo pelo backup desejado e reabra.<br>
  Caminho do banco atual: <code>${escHtml(dbPath)}</code>
</div>

<script>
const vscode = acquireVsCodeApi();

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
  btn.textContent = checked.length > 0 ? 'Excluir Selecionados (' + checked.length + ')' : 'Excluir Selecionados';
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
