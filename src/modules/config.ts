import * as vscode from "vscode";

export interface UserConfig {
  IDLE_TIMEOUT_MS: number;
  autoStart: boolean;
  showInStatusBar: boolean;
}

/**
 * Lê as configurações do usuário
 */
export function getConfig(): UserConfig {
  const config = vscode.workspace.getConfiguration("mymyTimeTrace");
  const idleTimeoutMinutes = config.get<number>("idleTimeout") || 5;
  const autoStart = config.get<boolean>("autoStart") || true;
  const showInStatusBar = config.get<boolean>("showInStatusBar") || true;

  return {
    IDLE_TIMEOUT_MS: idleTimeoutMinutes * 60 * 1000,
    autoStart,
    showInStatusBar,
  };
}
