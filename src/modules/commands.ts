import * as vscode from "vscode";
import { ApiKeyManager } from './apiKeyManager';
import { DeviceManager } from './deviceManager';
import { SyncManager } from './syncManager';
import { DatabaseManager } from './database';

/**
 * Classe responsável por gerenciar o registro de comandos
 */
export class CommandManager {
  /**
   * Função segura para registrar comandos - verifica se já existem antes
   */
  static safeRegisterCommand(
    commandId: string,
    handler: (...args: any[]) => any
  ): vscode.Disposable {
    try {
      return vscode.commands.registerCommand(commandId, handler);
    } catch (error) {
      // Se o comando já existe, tenta reutilizá-lo
      console.log(`Comando ${commandId} já existe, usando o existente`);
      // Disponibiliza o handler para contexto de teste
      return { dispose: () => {} };
    }
  }

  /**
   * Registra todos os comandos da extensão
   */
  static registerCommands(
    startTracking: () => void,
    pauseTracking: () => void,
    showStats: () => void,
    showDeletedProjects?: () => void
  ): vscode.Disposable[] {
    const commands: vscode.Disposable[] = [];

    console.log("📝 Registrando comandos da extensão...");

    commands.push(
      CommandManager.safeRegisterCommand("my-time-trace-vscode.startTracking", () => {
        console.log("🚀 Comando startTracking executado!");
        startTracking();
      })
    );

    commands.push(
      CommandManager.safeRegisterCommand("my-time-trace-vscode.pauseTracking", () => {
        console.log("⏸️ Comando pauseTracking executado!");
        pauseTracking();
      })
    );

    commands.push(
      CommandManager.safeRegisterCommand("my-time-trace-vscode.showStats", () => {
        console.log("📊 Comando showStats executado!");
        showStats();
      })
    );

    // Comando para mostrar projetos deletados com interface visual
    if (showDeletedProjects) {
      commands.push(
        CommandManager.safeRegisterCommand("my-time-trace-vscode.showDeletedProjects", () => {
          console.log("🗑️ Comando showDeletedProjects executado!");
          showDeletedProjects();
        })
      );
    }

    console.log(`✅ ${commands.length} comandos registrados com sucesso!`);
    return commands;
  }

  /**
   * Registra comandos de sincronização (API Key e Cloud Sync)
   * 
   * **Comandos:**
   * - setApiKey: Configurar API Key
   * - viewApiKey: Visualizar API Key atual (mascarada)
   * - revokeApiKey: Remover API Key (desativa sync)
   * 
   * @param context - Contexto da extensão
   * @param apiKeyManager - Gerenciador de API Key
   * @param deviceManager - Gerenciador de dispositivo
   */
  static registerSyncCommands(
    context: vscode.ExtensionContext,
    apiKeyManager: ApiKeyManager,
    deviceManager: DeviceManager,
    syncManager?: SyncManager
  ): vscode.Disposable[] {
    const commands: vscode.Disposable[] = [];

    console.log("🔄 Registrando comandos de sincronização...");

    // Comando: Set API Key
    commands.push(
      CommandManager.safeRegisterCommand("my-time-trace-vscode.setApiKey", async () => {
        console.log("🔐 Comando setApiKey executado!");

        const apiKey = await vscode.window.showInputBox({
          prompt: 'Cole sua API Key obtida na plataforma web MyTimeTrace',
          placeHolder: 'mtt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          password: true, // Oculta texto enquanto digita
          validateInput: (value) => {
            if (!value) {
              return 'API Key é obrigatória';
            }
            if (!/^mtt_[a-z0-9]{32}$/i.test(value)) {
              return 'Formato inválido. Esperado: mtt_xxxxx (32 caracteres)';
            }
            return null;
          }
        });

        if (!apiKey) {
          console.log('⏹️ Configuração de API Key cancelada pelo usuário');
          return;
        }

        try {
          // Salva API Key
          await apiKeyManager.setApiKey(apiKey);

          // Registra dispositivo no servidor (já valida API Key + conexão)
          const registered = await deviceManager.registerDevice(apiKey);
          if (!registered) {
            vscode.window.showWarningMessage(
              '⚠️ API Key salva, mas falha ao registrar dispositivo. Verifique se o backend está rodando e se a API Key é válida.'
            );
            return;
          }

          // Inicializa sincronização automática
          if (syncManager) {
            await syncManager.initialize();
            console.log('✅ Sync Manager inicializado após configuração de API Key');
          }

          vscode.window.showInformationMessage(
            '✅ API Key configurada! Dispositivo registrado e sincronização ativada.',
            'Sincronizar Agora'
          ).then(action => {
            if (action === 'Sincronizar Agora') {
              vscode.commands.executeCommand('my-time-trace-vscode.syncNow');
            }
          });
        } catch (error: any) {
          vscode.window.showErrorMessage(`❌ Erro ao configurar API Key: ${error.message}`);
          console.error('Erro ao configurar API Key:', error);
        }
      })
    );

    // Comando: View API Key
    commands.push(
      CommandManager.safeRegisterCommand("my-time-trace-vscode.viewApiKey", async () => {
        console.log("👁️ Comando viewApiKey executado!");

        const apiKey = await apiKeyManager.getApiKey();

        if (!apiKey) {
          vscode.window.showInformationMessage('❌ Nenhuma API Key configurada. Configure uma para ativar sincronização.');
          return;
        }

        // Mostra mascarada: mtt_abc...xyz
        const masked = await apiKeyManager.getMaskedApiKey();

        const action = await vscode.window.showInformationMessage(
          `API Key atual: ${masked}`,
          'Copiar Completa',
          'Testar Conexão'
        );

        if (action === 'Copiar Completa') {
          await vscode.env.clipboard.writeText(apiKey);
          vscode.window.showInformationMessage('✅ API Key copiada para clipboard!');
        } else if (action === 'Testar Conexão') {
          const isValid = await apiKeyManager.testConnection();
          if (isValid) {
            vscode.window.showInformationMessage('✅ Conexão com servidor OK!');
          } else {
            vscode.window.showWarningMessage('❌ Falha na conexão. Verifique se o backend está rodando.');
          }
        }
      })
    );

    // Comando: Revoke API Key
    commands.push(
      CommandManager.safeRegisterCommand("my-time-trace-vscode.revokeApiKey", async () => {
        console.log("🔓 Comando revokeApiKey executado!");

        const hasApiKey = await apiKeyManager.hasApiKey();
        if (!hasApiKey) {
          vscode.window.showInformationMessage('Nenhuma API Key configurada.');
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          'Deseja realmente remover a API Key?\n\nSincronização será desativada, mas dados locais serão mantidos.',
          { modal: true },
          'Sim, Remover'
        );

        if (confirm !== 'Sim, Remover') {
          console.log('⏹️ Remoção de API Key cancelada pelo usuário');
          return;
        }

        await apiKeyManager.revokeApiKey();
        await deviceManager.revokeDeviceKey(); // Remove device_key também
        vscode.window.showInformationMessage('✅ API Key removida. Modo local ativado.');
      })
    );

    console.log(`✅ ${commands.length} comandos de sincronização registrados!`);
    return commands;
  }

  /**
   * Registra comandos de operações de sincronização (Sync Now, Status)
   * 
   * **Comandos:**
    * - syncNow: Sincronização manual de envio (push)
   * - viewSyncStatus: Painel com status de sincronização
   * 
   * @param context - Contexto da extensão
   * @param apiKeyManager - Gerenciador de API Key
   * @param deviceManager - Gerenciador de dispositivo
   * @param syncManager - Gerenciador de sincronização
   */
  static registerSyncOperationsCommands(
    context: vscode.ExtensionContext,
    apiKeyManager: ApiKeyManager,
    deviceManager: DeviceManager,
    syncManager: SyncManager,
    dbManager: DatabaseManager
  ): vscode.Disposable[] {
    const commands: vscode.Disposable[] = [];

    console.log("🔄 Registrando comandos de operações de sync...");

    // Comando: Sync Now (sincronização manual)
    commands.push(
      CommandManager.safeRegisterCommand("my-time-trace-vscode.syncNow", async () => {
        console.log("🔄 Comando syncNow executado!");

        const hasApiKey = await apiKeyManager.hasApiKey();
        if (!hasApiKey) {
          const action = await vscode.window.showWarningMessage(
            'Sincronização requer uma API Key configurada.',
            'Configurar API Key'
          );

          if (action === 'Configurar API Key') {
            vscode.commands.executeCommand('my-time-trace-vscode.setApiKey');
          }
          return;
        }

        // Executa sync com progress notification
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'MyTimeTrace',
          cancellable: false
        }, async (progress) => {
          progress.report({ message: 'Enviando dados para Cloud...' });

          const success = await syncManager.performSync();

          if (success) {
            vscode.window.showInformationMessage('✅ Sincronização completa! - My Time Trace');
          } else {
            vscode.window.showWarningMessage('⚠️ Sincronização falhou. Verifique os logs.');
          }
        });
      })
    );

    // Comando: View Sync Status
    commands.push(
      CommandManager.safeRegisterCommand("my-time-trace-vscode.viewSyncStatus", async () => {
        console.log("📊 Comando viewSyncStatus executado!");

        const hasApiKey = await apiKeyManager.hasApiKey();
        if (!hasApiKey) {
          vscode.window.showInformationMessage('❌ Modo Local: Sincronização desabilitada.\n\nConfigure uma API Key para ativar sincronização.');
          return;
        }

        const apiKey = await apiKeyManager.getApiKey();
        if (!apiKey) {return;}

        // Busca status do servidor
        const status = await deviceManager.getSyncStatus(apiKey);

        if (!status) {
          vscode.window.showErrorMessage('❌ Erro ao buscar status de sincronização. O servidor pode estar indisponível temporariamente.');
          return;
        }

        // Busca total de entries locais do SQLite
        const localEntriesCount = await dbManager.getTotalEntriesCount();

        // Cria painel webview com status
        const panel = vscode.window.createWebviewPanel(
          'syncStatus',
          'Status de Sincronização - MyTimeTrace',
          vscode.ViewColumn.One,
          { enableScripts: true }
        );

        panel.webview.html = CommandManager.generateSyncStatusHTML(status, syncManager, localEntriesCount);
      })
    );

    console.log(`✅ ${commands.length} comandos de operações de sync registrados!`);
    return commands;
  }

  /**
   * Gera HTML para painel de status de sincronização
   * 
   * @param status - Status obtido do servidor
   * @param syncManager - Manager para obter config local
   * @param localEntriesCount - Total de entries no banco local SQLite
   * @returns HTML string
   */
  private static generateSyncStatusHTML(status: any, syncManager: SyncManager, localEntriesCount: number): string {
    const localStatus = syncManager.getStatus();
    
    // Mapear resposta do backend para estrutura esperada
    const totalDevices = (status?.otherDevicesCount || 0) + 1; // +1 = dispositivo atual
    
    const safeStatus = {
      currentDevice: {
        ...status?.currentDevice,
        deviceName: status?.currentDevice?.deviceName || 'Desconhecido',
        totalEntries: localEntriesCount, // Entries LOCAIS do SQLite
        lastSeen: status?.currentDevice?.lastSeen || new Date().toISOString()
      },
      otherDevices: status?.otherDevices || [],
      totals: {
        totalDevices: totalDevices,
        totalEntriesAllDevices: status?.totalEntriesAllDevices || 0
      }
    };
    
    const otherDevicesHTML = safeStatus.otherDevices.map((device: any) => `
      <tr>
        <td>${device.deviceName}</td>
        <td>${device.totalEntries}</td>
        <td>${new Date(device.lastSeen).toLocaleString('pt-BR')}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Status de Sincronização</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
          }
          
          h1 {
            color: var(--vscode-textLink-foreground);
            border-bottom: 2px solid var(--vscode-textLink-foreground);
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          
          h2 {
            color: var(--vscode-textPreformat-foreground);
            margin-top: 30px;
            margin-bottom: 15px;
          }
          
          .status-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
          }
          
          .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
          }
          
          .status-item {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            padding: 12px;
            border-radius: 6px;
          }
          
          .status-label {
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 5px;
          }
          
          .status-value {
            font-size: 1.4em;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          
          th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          
          th {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: bold;
          }
          
          tr:hover {
            background-color: var(--vscode-list-hoverBackground);
          }
          
          .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: bold;
          }
          
          .badge-success {
            background-color: var(--vscode-testing-iconPassed);
            color: #000;
          }
          
          .badge-warning {
            background-color: var(--vscode-editorWarning-foreground);
            color: #000;
          }
          
          .sync-times {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 10px;
          }
          
          .sync-time-badge {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            padding: 6px 12px;
            border-radius: 4px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <h1>📊 Status de Sincronização</h1>
        
        <div class="status-card">
          <h2>📱 Dispositivo Atual</h2>
          <div class="status-grid">
            <div class="status-item">
              <div class="status-label">Nome do Dispositivo</div>
              <div class="status-value">${safeStatus.currentDevice.deviceName}</div>
            </div>
            <div class="status-item">
              <div class="status-label">Entries Locais</div>
              <div class="status-value">${safeStatus.currentDevice.totalEntries}</div>
            </div>
            <div class="status-item">
              <div class="status-label">Última Atividade</div>
              <div class="status-value">${new Date(safeStatus.currentDevice.lastSeen).toLocaleString('pt-BR')}</div>
            </div>
          </div>
        </div>
        
        <div class="status-card">
          <h2>🌐 Totais Globais</h2>
          <div class="status-grid">
            <div class="status-item">
              <div class="status-label">Total de Dispositivos</div>
              <div class="status-value">${safeStatus.totals.totalDevices}</div>
            </div>
            <div class="status-item">
              <div class="status-label">Total de Entries (Cloud)</div>
              <div class="status-value">${safeStatus.totals.totalEntriesAllDevices}</div>
            </div>
            <div class="status-item">
              <div class="status-label">Status</div>
              <div class="status-value">
                <span class="badge ${localStatus.isSyncing ? 'badge-warning' : 'badge-success'}">
                  ${localStatus.isSyncing ? '🔄 Sincronizando' : '✅ Sincronizado'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        ${safeStatus.otherDevices.length > 0 ? `
        <div class="status-card">
          <h2>💻 Outros Dispositivos</h2>
          <table>
            <thead>
              <tr>
                <th>Dispositivo</th>
                <th>Entries</th>
                <th>Última Sincronização</th>
              </tr>
            </thead>
            <tbody>
              ${otherDevicesHTML}
            </tbody>
          </table>
        </div>
        ` : `
        <div class="status-card">
          <h2>💻 Outros Dispositivos</h2>
          <p style="color: var(--vscode-descriptionForeground);">
            Nenhum outro dispositivo sincronizado encontrado.
          </p>
        </div>
        `}
        
        <div class="status-card">
          <h2>⏰ Configurações de Auto-Sync</h2>
          <div class="status-label">Horários Programados</div>
          <div class="sync-times">
            ${localStatus.syncTimes.map(time => `<span class="sync-time-badge">${time}</span>`).join('')}
          </div>
          
          <div style="margin-top: 20px;">
            <div class="status-label">Configurações de Retry</div>
            <p style="color: var(--vscode-descriptionForeground); margin-top: 5px;">
              Máximo de tentativas: <strong>${localStatus.retryConfig.maxRetries}</strong><br>
              Delay entre tentativas: <strong>${localStatus.retryConfig.retryDelayMs / 1000}s</strong>
            </p>
          </div>
        </div>
        
        <div style="margin-top: 30px; padding: 15px; background-color: var(--vscode-textBlockQuote-background); border-left: 4px solid var(--vscode-textLink-foreground); border-radius: 4px;">
          <p style="margin: 0; color: var(--vscode-descriptionForeground);">
            💡 <strong>Dica:</strong> Use o comando <code>MyTimeTrace: Sync Now</code> para sincronizar manualmente a qualquer momento.
          </p>
        </div>
      </body>
      </html>
    `;
  }
}

