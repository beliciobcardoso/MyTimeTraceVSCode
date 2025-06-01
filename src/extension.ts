import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as sqlite3 from "sqlite3"; // Importa a biblioteca sqlite3

// Variáveis globais
let timerInterval: ReturnType<typeof setInterval> | undefined;
let lastActiveTime: number = Date.now();
let currentFile: string | undefined;
let projectRoot: string | undefined;
let timeSpentOnFile: number = 0; // Em segundos
let statusBarItem: vscode.StatusBarItem | undefined;
let isTracking: boolean = false;
let db: sqlite3.Database | undefined; // Instância do banco de dados

// Interface para os dados de atividade
interface ActivityData {
  timestamp: string;
  project: string | undefined;
  file: string | undefined;
  duration: number; // em segundos
  isIdle?: boolean;
}

// Lendo as configurações do usuário
function getConfig() {
  const config = vscode.workspace.getConfiguration("myTimeTracker");
  const idleTimeoutMinutes = config.get<number>("idleTimeout") || 5;
  const autoStart = config.get<boolean>("autoStart") || true;
  const showInStatusBar = config.get<boolean>("showInStatusBar") || true;

  return {
    IDLE_TIMEOUT_MS: idleTimeoutMinutes * 60 * 1000,
    autoStart,
    showInStatusBar,
  };
}

const userConfig = getConfig();
const IDLE_TIMEOUT_MS = userConfig.IDLE_TIMEOUT_MS;

// Função para inicializar o banco de dados SQLite
async function initializeDatabase(
  storagePath: string
): Promise<sqlite3.Database> {
  const dbPath = path.join(storagePath, "time_tracker.sqlite");
  console.log(`Caminho do banco de dados: ${dbPath}`);

  // Garante que o diretório de armazenamento global exista
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(dbPath, (err: Error | null) => {
      if (err) {
        vscode.window.showErrorMessage(
          `Erro ao conectar ao SQLite: ${err.message}`
        );
        console.error("Erro ao conectar ao SQLite:", err);
        return reject(err);
      }
      console.log("Conectado ao banco de dados SQLite.");

      // Cria a tabela se não existir
      database.run(
        `CREATE TABLE IF NOT EXISTS time_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            project TEXT,
            file TEXT,
            duration_seconds INTEGER NOT NULL,
            is_idle INTEGER DEFAULT 0,
            synced INTEGER DEFAULT 0 -- 0 para não sincronizado, 1 para sincronizado
        )`,
        (tableErr: Error | null) => {
          if (tableErr) {
            vscode.window.showErrorMessage(
              `Erro ao criar tabela: ${tableErr.message}`
            );
            console.error("Erro ao criar tabela:", tableErr);
            return reject(tableErr);
          }
          console.log('Tabela "time_entries" verificada/criada com sucesso.');
          resolve(database);
        }
      );
    });
  });
}

// Função para salvar dados localmente no SQLite
async function saveActivityData(data: ActivityData) {
  if (!db) {
    console.error(
      "Banco de dados não inicializado. Não foi possível salvar os dados."
    );
    vscode.window.showWarningMessage(
      "Monitoramento de tempo: Banco de dados não está pronto."
    );
    return;
  }

  console.log("Salvando dados localmente:", data);
  const { timestamp, project, file, duration, isIdle } = data;

  const stmt = db.prepare(
    "INSERT INTO time_entries (timestamp, project, file, duration_seconds, is_idle) VALUES (?, ?, ?, ?, ?)"
  );
  stmt.run(
    timestamp,
    project || "unknown-project",
    file || "unknown-file",
    duration,
    isIdle ? 1 : 0,
    (error: Error | null) => {
      if (error) {
        console.error("Erro ao inserir dados no SQLite:", error);
        vscode.window.showErrorMessage(
          `Erro ao salvar dados: ${error.message}`
        );
      } else {
        console.log("Dados salvos localmente com sucesso.");
      }
      stmt.finalize();
    }
  );
}

// Salva tempo em arquivo atual e reseta contador
function resetFileTimerAndSave() {
  if (currentFile && projectRoot && timeSpentOnFile > 0) {
    const data: ActivityData = {
      timestamp: new Date().toISOString(),
      project: projectRoot,
      file: currentFile,
      duration: Math.round(timeSpentOnFile / 1000), // Convertendo ms para segundos
    };
    saveActivityData(data); // Salva os dados localmente
  }
  timeSpentOnFile = 0;
}

// Função para começar a rastrear um novo arquivo
function startTrackingFile() {
  lastActiveTime = Date.now(); // Atualiza o tempo da última atividade
  if (vscode.window.activeTextEditor) {
    const editor = vscode.window.activeTextEditor;
    const newFile = editor.document.fileName;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      editor.document.uri
    );
    const newProjectRoot = workspaceFolder
      ? workspaceFolder.name
      : "unknown-project";

    if (currentFile !== newFile || projectRoot !== newProjectRoot) {
      resetFileTimerAndSave(); // Salva o tempo do arquivo anterior
      currentFile = newFile;
      projectRoot = newProjectRoot;
      timeSpentOnFile = 0; // Reseta o contador para o novo arquivo
      console.log(
        `Mudou para o arquivo: ${currentFile} no projeto ${projectRoot}`
      );
    }
  } else {
    // Nenhum editor ativo, salva o tempo do último arquivo se houver
    resetFileTimerAndSave();
    currentFile = undefined;
  }
}

// Função para formatar o tempo em HH:MM:SS
function formatTime(timeInSeconds: number): string {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = Math.floor(timeInSeconds % 60);

  return [
    hours > 0 ? `${hours}h` : "",
    minutes > 0 ? `${minutes}m` : "",
    `${seconds}s`,
  ]
    .filter(Boolean)
    .join(" ");
}

// Função para criar e atualizar o status bar item
function createStatusBarItem() {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left
    );
    statusBarItem.command = "my-time-trace-vscode.showStats";
    statusBarItem.tooltip = "Clique para ver estatísticas de tempo";
  }

  const userConfig = getConfig();
  if (userConfig.showInStatusBar) {
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

// Função para atualizar o texto do status bar item
function updateStatusBarItem() {
  if (!statusBarItem || !userConfig.showInStatusBar) {
    return;
  }

  const fileName = currentFile ? path.basename(currentFile) : "Nenhum arquivo";
  const timeFormatted = formatTime(Math.round(timeSpentOnFile / 1000));

  statusBarItem.text = `$(clock) ${fileName}: ${timeFormatted}`;

  if (isTracking) {
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
  }
}

// Função para iniciar o rastreamento
function startTracking() {
  isTracking = true;
  startTrackingFile();
  updateStatusBarItem();

  // Reinicia o timer se já estiver rodando
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  // Configura o timer para monitoramento contínuo
  timerInterval = setInterval(() => {
    if (!db) {
      return; // Não faz nada se o DB não estiver pronto
    }

    const now = Date.now();
    if (now - lastActiveTime > IDLE_TIMEOUT_MS) {
      if (currentFile && timeSpentOnFile > 0) {
        console.log(
          `Usuário inativo. Última atividade no arquivo: ${currentFile}. Salvando...`
        );
        resetFileTimerAndSave(); // Salva o tempo do arquivo antes de marcar como inativo

        // Envia um registro de "idle"
        saveActivityData({
          timestamp: new Date(lastActiveTime + timeSpentOnFile).toISOString(),
          project: projectRoot,
          file: "IDLE", // Marca como um período de inatividade
          duration: Math.round(
            (now - (lastActiveTime + timeSpentOnFile)) / 1000
          ),
          isIdle: true,
        });

        currentFile = undefined; // Limpa o arquivo atual, pois está inativo
        timeSpentOnFile = 0; // Reseta o contador
      }
      return;
    }

    // Se um arquivo estiver ativo e o usuário não estiver inativo
    if (currentFile) {
      timeSpentOnFile += 1000; // Incrementa 1 segundo
      updateStatusBarItem(); // Atualiza a barra de status
    } else if (vscode.window.activeTextEditor) {
      // Se não havia arquivo atual mas há um editor ativo, voltou da inatividade
      console.log("Usuário voltou da inatividade ou abriu um arquivo.");
      startTrackingFile(); // Reinicia o rastreamento
    }
  }, 1000); // Verifica a cada segundo

  vscode.window.showInformationMessage("Monitoramento de tempo iniciado!");
}

// Função para pausar o rastreamento
function pauseTracking() {
  isTracking = false;
  resetFileTimerAndSave();

  // Para o temporizador
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = undefined;
  }

  updateStatusBarItem();
  vscode.window.showInformationMessage("Monitoramento de tempo pausado!");
}

// Função para mostrar estatísticas
async function showStats() {
  if (!db) {
    vscode.window.showErrorMessage(
      "Banco de dados não inicializado. Tente novamente mais tarde."
    );
    return;
  }

  db.all(
    `SELECT 
      project, 
      SUM(duration_seconds) as total_seconds, 
      COUNT(*) as entries 
    FROM time_entries 
    WHERE is_idle = 0 
    GROUP BY project 
    ORDER BY total_seconds DESC`,
    [],
    (err: Error | null, rows: any[]) => {
      if (err) {
        vscode.window.showErrorMessage(
          `Erro ao carregar estatísticas: ${err.message}`
        );
        return;
      }

      // Criando o painel
      const panel = vscode.window.createWebviewPanel(
        "timeTrackerStats",
        "Estatísticas de Tempo",
        vscode.ViewColumn.One,
        {}
      );

      let statsHtml = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; }
          table { border-collapse: collapse; width: 100%; }
          th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
          tr:nth-child(even) { background-color: #f2f2f2; }
          th { background-color: #4CAF50; color: white; }
        </style>
      </head>
      <body>
        <h1>Estatísticas de Tempo por Projeto</h1>
        <table>
          <tr>
            <th>Projeto</th>
            <th>Tempo Total</th>
            <th>Entradas</th>
          </tr>
      `;

      rows.forEach((row) => {
        statsHtml += `
        <tr>
          <td>${row.project}</td>
          <td>${formatTime(row.total_seconds)}</td>
          <td>${row.entries}</td>
        </tr>
        `;
      });

      statsHtml += `
        </table>
        <p><em>Dados coletados até: ${new Date().toLocaleString()}</em></p>
      </body>
      </html>
      `;

      panel.webview.html = statsHtml;
    }
  );
}

// Ativação da extensão
export async function activate(context: vscode.ExtensionContext) {
  // Adicionando logs detalhados para depuração
  console.log("=======================================");
  console.log('Extensão "my-time-trace-vscode" ativada!');
  console.log("Versão: 0.0.1");
  console.log("Data/Hora: " + new Date().toISOString());
  console.log("=======================================");

  // Obtém o caminho de armazenamento global da extensão
  const globalStoragePath = context.globalStorageUri.fsPath;
  console.log(`Caminho de armazenamento global: ${globalStoragePath}`);

  try {
    db = await initializeDatabase(globalStoragePath);
  } catch (error) {
    console.error("Falha ao inicializar o banco de dados na ativação:", error);
    vscode.window.showErrorMessage(
      "Monitoramento de tempo: Falha ao iniciar o banco de dados."
    );
    return; // Impede a ativação completa se o DB falhar
  }

  // Criar e mostrar o status bar item
  createStatusBarItem();

  // Registra os comandos
  let disposableStart = vscode.commands.registerCommand(
    "my-time-trace-vscode.startTracking",
    startTracking
  );

  let disposablePause = vscode.commands.registerCommand(
    "my-time-trace-vscode.pauseTracking",
    pauseTracking
  );

  let disposableStats = vscode.commands.registerCommand(
    "my-time-trace-vscode.showStats",
    showStats
  );

  // Registra os eventos para monitoramento
  let editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (!db) {
        return;
      }
      lastActiveTime = Date.now(); // Atualiza lastActiveTime em uma interação
      if (editor) {
        const newFile = editor.document.fileName;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(
          editor.document.uri
        );
        const newProjectRoot = workspaceFolder
          ? workspaceFolder.name
          : "unknown-project";

        if (currentFile !== newFile || projectRoot !== newProjectRoot) {
          resetFileTimerAndSave();
          currentFile = newFile;
          projectRoot = newProjectRoot;
          timeSpentOnFile = 0;
          console.log(
            `Foco no arquivo: ${currentFile} no projeto ${projectRoot}`
          );
          updateStatusBarItem();
        }
      } else {
        resetFileTimerAndSave();
        currentFile = undefined;
        console.log("Nenhum editor de texto ativo.");
        updateStatusBarItem();
      }
    }
  );

  let textChangeDisposable = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (!db) {
        return;
      }
      // Considera apenas edições reais
      if (event.contentChanges.length > 0) {
        lastActiveTime = Date.now();
        if (!currentFile && vscode.window.activeTextEditor) {
          console.log("Texto alterado, reativando rastreamento do arquivo.");
          startTrackingFile();
          updateStatusBarItem();
        }
      }
    }
  );

  let windowStateDisposable = vscode.window.onDidChangeWindowState(
    (windowState) => {
      if (!db) {
        return;
      }
      if (windowState.focused) {
        lastActiveTime = Date.now();
        console.log("Janela do VSCode focada.");
        if (!currentFile && vscode.window.activeTextEditor) {
          startTrackingFile();
          updateStatusBarItem();
        }
      } else {
        console.log("Janela do VSCode perdeu o foco. Salvando tempo atual.");
        resetFileTimerAndSave();
        updateStatusBarItem();
      }
    }
  );

  // Adiciona todos os subscriptions ao contexto para serem descartados ao desativar
  context.subscriptions.push(disposableStart);
  context.subscriptions.push(disposablePause);
  context.subscriptions.push(disposableStats);
  context.subscriptions.push(editorChangeDisposable);
  context.subscriptions.push(textChangeDisposable);
  context.subscriptions.push(windowStateDisposable);

  // Adiciona cleanup handler
  context.subscriptions.push({
    dispose: () => {
      console.log("Desativando a extensão e fechando o banco de dados.");
      resetFileTimerAndSave(); // Salva o último período
      if (timerInterval) {
        clearInterval(timerInterval);
      }
      if (db) {
        db.close((err: Error | null) => {
          if (err) {
            return console.error(
              "Erro ao fechar o banco de dados SQLite:",
              err.message
            );
          }
          console.log("Banco de dados SQLite fechado.");
        });
      }
      if (statusBarItem) {
        statusBarItem.dispose();
      }
    },
  });

  // Inicia o monitoramento automaticamente se configurado
  if (userConfig.autoStart) {
    vscode.commands.executeCommand("my-time-trace-vscode.startTracking");
  }
}

export function deactivate() {
  console.log('Extensão "my-time-trace-vscode" explicitamente desativada!');
  // A lógica de limpeza está no dispose dos subscriptions registrados
}
