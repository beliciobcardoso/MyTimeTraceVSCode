import * as nls from 'vscode-nls';
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();
import { DatabaseManager, ActivityData } from "./database";
import { StatusBarManager } from "./statusBar";
import { getConfig } from "./config";

/**
 * Classe responsável por rastrear o tempo gasto em arquivos
 */
export class timeTrace {
  private timerInterval: ReturnType<typeof setInterval> | undefined;
  private lastActiveTime: number = Date.now();
  private currentFile: string | undefined;
  private projectRoot: string | undefined;
  private timeSpentOnFile: number = 0; // Em milissegundos
  private isTracking: boolean = false;

  constructor(
    private dbManager: DatabaseManager,
    private statusBarManager: StatusBarManager
  ) {}

  /**
   * Salva tempo em arquivo atual e reseta contador
   */
  private async resetFileTimerAndSave(): Promise<void> {
    if (this.currentFile && this.projectRoot && this.timeSpentOnFile > 0) {
      const data: ActivityData = {
        timestamp: new Date().toISOString(),
        project: this.projectRoot,
        file: this.currentFile,
        duration: Math.round(this.timeSpentOnFile / 1000), // Convertendo ms para segundos
      };
      await this.dbManager.saveActivityData(data);
    }
    this.timeSpentOnFile = 0;
  }

  /**
   * Função para começar a rastrear um novo arquivo
   */
  private startTrackingFile(): void {
    this.lastActiveTime = Date.now();
    if (vscode.window.activeTextEditor) {
      const editor = vscode.window.activeTextEditor;
      const newFile = editor.document.fileName;
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      const newProjectRoot = workspaceFolder ? workspaceFolder.name : "unknown-project";

      if (this.currentFile !== newFile || this.projectRoot !== newProjectRoot) {
        this.resetFileTimerAndSave(); // Salva o tempo do arquivo anterior
        this.currentFile = newFile;
        this.projectRoot = newProjectRoot;
        this.timeSpentOnFile = 0; // Reseta o contador para o novo arquivo
        console.log(`Mudou para o arquivo: ${this.currentFile} no projeto ${this.projectRoot}`);
      }
    } else {
      // Nenhum editor ativo, salva o tempo do último arquivo se houver
      this.resetFileTimerAndSave();
      this.currentFile = undefined;
    }
  }

  /**
   * Inicia o rastreamento de tempo
   */
  startTracking(): void {
    this.isTracking = true;
    this.startTrackingFile();
    this.statusBarManager.update(this.currentFile, this.timeSpentOnFile, this.isTracking);

    // Reinicia o timer se já estiver rodando
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    const config = getConfig();

    // Configura o timer para monitoramento contínuo
    this.timerInterval = setInterval(async () => {
      if (!this.dbManager.isInitialized()) {
        return; // Não faz nada se o DB não estiver pronto
      }

      const now = Date.now();
      if (now - this.lastActiveTime > config.IDLE_TIMEOUT_MS) {
        if (this.currentFile && this.timeSpentOnFile > 0) {
          console.log(
            `Usuário inativo. Última atividade no arquivo: ${this.currentFile}. Salvando...`
          );
          await this.resetFileTimerAndSave(); // Salva o tempo do arquivo antes de marcar como inativo

          // Envia um registro de "idle"
          await this.dbManager.saveActivityData({
            timestamp: new Date(this.lastActiveTime + this.timeSpentOnFile).toISOString(),
            project: this.projectRoot,
            file: "IDLE", // Marca como um período de inatividade
            duration: Math.round((now - (this.lastActiveTime + this.timeSpentOnFile)) / 1000),
            isIdle: true,
          });

          this.currentFile = undefined; // Limpa o arquivo atual, pois está inativo
          this.timeSpentOnFile = 0; // Reseta o contador
        }
        return;
      }

      // Se um arquivo estiver ativo e o usuário não estiver inativo
      if (this.currentFile) {
        this.timeSpentOnFile += 1000; // Incrementa 1 segundo
        this.statusBarManager.update(this.currentFile, this.timeSpentOnFile, this.isTracking);
      } else if (vscode.window.activeTextEditor) {
        // Se não havia arquivo atual mas há um editor ativo, voltou da inatividade
        console.log("Usuário voltou da inatividade ou abriu um arquivo.");
        this.startTrackingFile(); // Reinicia o rastreamento
      }
    }, 1000); // Verifica a cada segundo

    vscode.window.showInformationMessage(localize('timeTrace.trackingStarted', 'Time tracking started!'));
  }

  /**
   * Pausa o rastreamento de tempo
   */
  pauseTracking(): void {
    this.isTracking = false;
    this.resetFileTimerAndSave();

    // Para o temporizador
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }

    this.statusBarManager.update(this.currentFile, this.timeSpentOnFile, this.isTracking);
    vscode.window.showInformationMessage(localize('timeTrace.trackingPaused', 'Time tracking paused!'));
  }

  /**
   * Manipula mudança de editor ativo
   */
  onActiveEditorChange(editor: vscode.TextEditor | undefined): void {
    if (!this.dbManager.isInitialized() || !this.isTracking) {
      return;
    }
    
    this.lastActiveTime = Date.now();
    if (editor) {
      const newFile = editor.document.fileName;
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      const newProjectRoot = workspaceFolder ? workspaceFolder.name : "unknown-project";

      if (this.currentFile !== newFile || this.projectRoot !== newProjectRoot) {
        this.resetFileTimerAndSave();
        this.currentFile = newFile;
        this.projectRoot = newProjectRoot;
        this.timeSpentOnFile = 0;
        console.info(`Foco no arquivo: ${this.currentFile} no projeto ${this.projectRoot}`);
        this.statusBarManager.update(this.currentFile, this.timeSpentOnFile, this.isTracking);
      }
    } else {
      this.resetFileTimerAndSave();
      this.currentFile = undefined;
      console.log("Nenhum editor de texto ativo.");
      this.statusBarManager.update(this.currentFile, this.timeSpentOnFile, this.isTracking);
    }
  }

  /**
   * Manipula mudança de texto no documento
   */
  onTextDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    if (!this.dbManager.isInitialized() || !this.isTracking) {
      return;
    }
    
    if (event.contentChanges.length > 0) {
      this.lastActiveTime = Date.now();
      if (!this.currentFile && vscode.window.activeTextEditor) {
        console.log("Texto alterado, reativando rastreamento do arquivo.");
        this.startTrackingFile();
        this.statusBarManager.update(this.currentFile, this.timeSpentOnFile, this.isTracking);
      }
    }
  }

  /**
   * Manipula mudança de estado da janela
   */
  onWindowStateChange(windowState: vscode.WindowState): void {
    if (!this.dbManager.isInitialized()) {
      return;
    }
    
    if (windowState.focused) {
      this.lastActiveTime = Date.now();
      console.log("Janela do VSCode focada.");
      if (this.isTracking && !this.currentFile && vscode.window.activeTextEditor) {
        this.startTrackingFile();
        this.statusBarManager.update(this.currentFile, this.timeSpentOnFile, this.isTracking);
      }
    } else {
      console.log("Janela do VSCode perdeu o foco. Salvando tempo atual se rastreando.");
      if (this.isTracking) {
        this.resetFileTimerAndSave();
      }
      this.statusBarManager.update(this.currentFile, this.timeSpentOnFile, this.isTracking);
    }
  }

  /**
   * Verifica se está rastreando
   */
  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Limpa recursos do my_time_trace
   */
  dispose(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
      console.log("TimerInterval limpo.");
    }
    this.resetFileTimerAndSave();
  }
}
