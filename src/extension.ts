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
let globalContext: vscode.ExtensionContext | null = null;

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

  // Primeiro obtemos a lista de projetos com seus totais
  db!.all(
    `SELECT 
      project, 
      SUM(duration_seconds) as total_seconds 
    FROM time_entries 
    WHERE is_idle = 0 
    GROUP BY project 
    ORDER BY total_seconds DESC`,
    [],
    (err: Error | null, projectRows: any[]) => {
      if (err) {
        vscode.window.showErrorMessage(
          `Erro ao carregar estatísticas de projetos: ${err.message}`
        );
        return;
      }

      // Obtém os detalhes de cada arquivo por projeto
      db!.all(
        `SELECT 
          project, 
          file,
          SUM(duration_seconds) as file_seconds
        FROM time_entries 
        WHERE is_idle = 0 
        GROUP BY project, file
        ORDER BY project, file_seconds DESC`,
        [],
        (fileErr: Error | null, fileRows: any[]) => {
          if (fileErr) {
            vscode.window.showErrorMessage(
              `Erro ao carregar estatísticas de arquivos: ${fileErr.message}`
            );
            return;
          }

          // Agrupa os arquivos por projeto
          const projectsWithFiles: {
            [projectName: string]: {
              totalSeconds: number;
              files: {
                name: string;
                seconds: number;
              }[];
            };
          } = {};

          // Inicializa os projetos com os dados totais
          projectRows.forEach((project) => {
            projectsWithFiles[project.project] = {
              totalSeconds: project.total_seconds,
              files: [],
            };
          });

          // Adiciona os arquivos aos seus projetos correspondentes
          fileRows.forEach((fileRow) => {
            if (projectsWithFiles[fileRow.project]) {
              projectsWithFiles[fileRow.project].files.push({
                name: fileRow.file,
                seconds: fileRow.file_seconds,
              });
            }
          });

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
              body { font-family: Arial, sans-serif; padding: 20px 0px;}
              h1, h2 { color: #fff; }
              .project-header { 
                background-color: #4CAF50; 
                color: white; 
                padding: 10px; 
                margin-bottom: 0;
                border-top-left-radius: 5px;
                border-top-right-radius: 5px;
              }
              table { border-collapse: collapse; width: 100%; margin-bottom: 0px; border: 1px solid #000; border-radius: 5px;}
              th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
              th { background-color: #4682B4; color: white; }
              tr:nth-child(even) { background-color: #f2f2f2; color: #000000; }
              .file-name { font-family: monospace; }
              .project-section { margin-bottom: 0px; padding: 0px;}
            </style>
          </head>
          <body>
            <h1>Estatísticas de Tempo por Projeto</h1>
          `;

          // Para cada projeto, criar uma seção com seus arquivos
          Object.entries(projectsWithFiles).forEach(
            ([projectName, projectData]) => {
              statsHtml += `
            <div class="project-section">
              <h2 class="project-header">Projeto: ${projectName} - Total ${formatTime(
                projectData.totalSeconds
              )}</h2>
              <table>
                <tr>
                  <th>Arquivos</th>
                  <th>Tempo</th>
                </tr>
            `;

              // Adiciona cada arquivo do projeto
              projectData.files.forEach((file) => {
                // Extrai apenas o caminho relativo do projeto, removendo o caminho absoluto inicial
                let displayPath = file.name;

                // Abordagem 1: Se o nome do projeto estiver no caminho, pega a partir dele
                if (displayPath.includes(projectName)) {
                  displayPath = displayPath.substring(
                    displayPath.indexOf(projectName)
                  );
                }
                // Abordagem 2: Pega só o nome do arquivo se for IDLE ou unknown-file
                else if (
                  displayPath === "IDLE" ||
                  displayPath === "unknown-file"
                ) {
                  // Mantém sem alterações
                }
                // Abordagem 3: Remove caminhos absolutos comuns
                else {
                  // Remove prefixos comuns de caminho absoluto (como /home/, C:\Users\, etc)
                  const patterns = [
                    "/home/",
                    "/Users/",
                    "C:\\Users\\",
                    "/var/",
                    "/tmp/",
                    "C:\\",
                  ];
                  for (const pattern of patterns) {
                    if (displayPath.includes(pattern)) {
                      // Encontra a posição após o diretório /home/usuário/
                      const parts = displayPath.split(pattern);
                      if (parts.length > 1) {
                        // Pula a primeira parte (vazia) e o nome do usuário
                        const userParts = parts[1].split("/");
                        if (userParts.length > 1) {
                          // Remove /home/usuário e começa a partir do primeiro diretório de projetos
                          displayPath = userParts.slice(1).join("/");
                          break;
                        }
                      }
                    }
                  }
                }

                statsHtml += `
              <tr>
                <td class="file-name">${displayPath}</td>
                <td>${formatTime(file.seconds)}</td>
              </tr>
              `;
              });

              statsHtml += `
              </table>
            </div>
            `;
            }
          );

          statsHtml += `
            <p><em>Dados coletados até: ${new Date().toLocaleString()}</em></p>
          </body>
          </html>
          `;

          panel.webview.html = statsHtml;
        }
      );
    }
  );
}

// Ativação da extensão
export async function activate(context: vscode.ExtensionContext) {
  globalContext = context; // Armazena o contexto globalmente
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

  // Função segura para registrar comandos - verifica se já existem antes
  const safeRegisterCommand = (
    commandId: string,
    handler: (...args: any[]) => any
  ) => {
    try {
      return vscode.commands.registerCommand(commandId, handler);
    } catch (error) {
      // Se o comando já existe, tenta reutilizá-lo
      console.log(`Comando ${commandId} já existe, usando o existente`);
      // Disponibiliza o handler para contexto de teste
      return { dispose: () => {} };
    }
  };

  // Registra os comandos de forma segura
  const commandStart = safeRegisterCommand(
    "my-time-trace-vscode.startTracking",
    startTracking
  );

  const commandPause = safeRegisterCommand(
    "my-time-trace-vscode.pauseTracking",
    pauseTracking
  );

  const commandStats = safeRegisterCommand(
    "my-time-trace-vscode.showStats",
    showStats
  );

  // Registra os eventos para monitoramento
  const eventEditorChange = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (!db || !isTracking) {
        // Verifica também se isTracking é true
        return;
      }
      lastActiveTime = Date.now();
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
          console.info(
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

  const eventTextChange = vscode.workspace.onDidChangeTextDocument((event) => {
    if (!db || !isTracking) {
      // Verifica também se isTracking é true
      return;
    }
    if (event.contentChanges.length > 0) {
      lastActiveTime = Date.now();
      if (!currentFile && vscode.window.activeTextEditor) {
        console.log("Texto alterado, reativando rastreamento do arquivo.");
        startTrackingFile();
        updateStatusBarItem();
      }
    }
  });

  const eventWindowStateChange = vscode.window.onDidChangeWindowState(
    (windowState) => {
      if (!db) {
        return;
      }
      if (windowState.focused) {
        lastActiveTime = Date.now();
        console.log("Janela do VSCode focada.");
        if (isTracking && !currentFile && vscode.window.activeTextEditor) {
          // Verifica isTracking
          startTrackingFile();
          updateStatusBarItem();
        }
      } else {
        console.log(
          "Janela do VSCode perdeu o foco. Salvando tempo atual se rastreando."
        );
        if (isTracking) {
          // Só salva se estiver rastreando
          resetFileTimerAndSave();
        }
        updateStatusBarItem(); // Atualiza status bar mesmo se não estava rastreando (para mostrar pausado)
      }
    }
  );

  // Adiciona todos os subscriptions ao contexto para serem descartados ao desativar
  context.subscriptions.push(commandStart);
  context.subscriptions.push(commandPause);
  context.subscriptions.push(commandStats);
  context.subscriptions.push(eventEditorChange);
  context.subscriptions.push(eventTextChange);
  context.subscriptions.push(eventWindowStateChange);

  // Adiciona um handler de dispose para o timerInterval, caso ele exista
  // Isso é importante para garantir que o timer seja limpo quando a extensão for desativada.
  context.subscriptions.push({
    dispose: () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = undefined;
        console.log("TimerInterval limpo via context.subscriptions.");
      }
    },
  });

  // Adiciona um handler de dispose para o statusBarItem
  context.subscriptions.push({
    dispose: () => {
      if (statusBarItem) {
        statusBarItem.dispose();
        statusBarItem = undefined;
        console.log("StatusBarItem limpo via context.subscriptions.");
      }
    },
  });

  // Auto-iniciar se configurado
  const userConfig = getConfig();
  if (userConfig.autoStart) {
    // Pequeno delay para garantir que a extensão esteja totalmente carregada
    setTimeout(() => {
      if (!isTracking) {
        // Só inicia se não estiver já rastreando (ex: reativação)
        vscode.commands.executeCommand("my-time-trace-vscode.startTracking");
      }
    }, 100);
  } else {
    // Se não for autoStart, garante que o estado inicial seja 'pausado'
    isTracking = false;
    updateStatusBarItem();
  }
}

// Desativação da extensão
export function deactivate() {
  console.log("=======================================");
  console.log('Extensão "my-time-trace-vscode" desativada!');
  console.log("Data/Hora: " + new Date().toISOString());
  console.log("=======================================");

  // 1. Parar o timer e salvar dados pendentes
  // O timerInterval deve ser limpo pelas subscriptions, mas por segurança:
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = undefined;
    console.log("TimerInterval explicitamente limpo em deactivate.");
  }
  // Salva qualquer tempo pendente ANTES de limpar subscriptions de comandos
  resetFileTimerAndSave();

  // 2. Limpar subscriptions (comandos, listeners, statusBarItem)
  // O VS Code chama dispose em cada item em context.subscriptions quando a extensão é desativada.
  // Se globalContext foi setado e tem subscriptions, elas serão limpas.
  // Não precisamos iterar manualmente aqui se a activate as adicionou corretamente.
  // Apenas garantimos que o globalContext seja limpo.
  if (globalContext) {
    // As subscriptions em globalContext.subscriptions são descartadas pelo VS Code.
    // Apenas limpamos nossa referência.
    console.log(
      `Limpando ${globalContext.subscriptions.length} subscriptions do globalContext.`
    );
  }

  // 3. Fechar o banco de dados
  if (db) {
    db.close((err: Error | null) => {
      if (err) {
        console.error(
          "Erro ao fechar o banco de dados em deactivate:",
          err.message
        );
      } else {
        console.log("Banco de dados fechado com sucesso em deactivate.");
      }
      db = undefined; // Importante para o próximo teste
    });
  } else {
    console.log(
      "Banco de dados já estava fechado ou não inicializado em deactivate."
    );
  }

  // 4. Resetar estado global da extensão
  isTracking = false;
  currentFile = undefined;
  projectRoot = undefined;
  timeSpentOnFile = 0;
  // statusBarItem já deve ter sido disposed via subscriptions.
  statusBarItem = undefined;
  globalContext = null; // Limpa a referência ao contexto global
}
