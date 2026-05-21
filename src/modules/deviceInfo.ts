import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

/**
 * Módulo responsável por capturar informações do dispositivo
 */

/**
 * Retorna o nome do dispositivo/computador atual
 * @returns Nome do host/dispositivo
 */
export function getDeviceName(): string {
  try {
    const hostname = os.hostname();
    console.log(`🖥️ Device Name: ${hostname}`);
    return hostname;
  } catch (error) {
    console.error('❌ Erro ao obter nome do dispositivo:', error);
    return 'unknown-device';
  }
}

/**
 * Retorna informações adicionais do dispositivo (para uso futuro)
 */
export function getDeviceInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    type: os.type(),
    release: os.release(),
    userInfo: os.userInfo(),
    version: os.version(),
  };
}

// Mapeamento de segmentos de path → nome da IDE (mais específico primeiro)
const IDE_PATH_SEGMENTS: Array<[string, string]> = [
  ['Code - Insiders/User/globalStorage/', 'Code - Insiders'],
  ['Code/User/globalStorage/', 'VS Code'],
  ['Cursor/User/globalStorage/', 'Cursor'],
  ['Windsurf/User/globalStorage/', 'Windsurf'],
  ['Google Antigravity/User/globalStorage/', 'Google Antigravity'],
];

const NATIVE_IDES = ['VS Code', 'Code - Insiders'];

/**
 * Detecta o nome da IDE em execução usando três camadas de fallback.
 *
 * 1ª: globalStorageUri.fsPath (mais confiável, sem I/O)
 * 2ª: variáveis de ambiente (VSCODE_RELEASE, VSCODE_VERSION)
 * 3ª: process.execPath
 * Fallback final: "unknown"
 */
export function getIdeName(globalStorageUriPath: string): string {
  // Camada 1: path do globalStorageUri
  for (const [segment, name] of IDE_PATH_SEGMENTS) {
    if (globalStorageUriPath.includes(segment)) {
      return name;
    }
  }

  // Camada 2: variáveis de ambiente
  const envName = _detectIdeFromEnv();
  if (envName) {
    return envName;
  }

  // Camada 3: process.execPath
  const processName = _detectIdeFromProcess();
  if (processName) {
    return processName;
  }

  return 'unknown';
}

/** @internal Visível apenas para testes */
export function _detectIdeFromEnv(): string | null {
  const release = process.env.VSCODE_RELEASE;
  if (release === 'stable') {
    const execPath = process.execPath.toLowerCase();
    const hasFork = execPath.includes('cursor') || execPath.includes('windsurf') || execPath.includes('antigravity');
    if (!hasFork) {
      return 'VS Code';
    }
  }
  return null;
}

/** @internal Visível apenas para testes */
export function _detectIdeFromProcess(): string | null {
  const execPath = process.execPath.toLowerCase();
  if (execPath.includes('cursor')) { return 'Cursor'; }
  if (execPath.includes('windsurf')) { return 'Windsurf'; }
  if (execPath.includes('antigravity')) { return 'Google Antigravity'; }
  if (execPath.includes('code-insiders') || execPath.includes('code - insiders')) { return 'Code - Insiders'; }
  if (execPath.includes('code')) { return 'VS Code'; }
  return null;
}

/**
 * Retorna a versão da IDE detectada.
 *
 * - VS Code / Code - Insiders: usa vscode.version (API nativa)
 * - Forks (Cursor, Windsurf, etc.): lê resources/app/package.json da instalação;
 *   se inacessível, retorna `vscode.version + "-base"`
 * - unknown: retorna "unknown"
 */
export function getIdeVersion(ideName: string): string {
  if (ideName === 'unknown') {
    return 'unknown';
  }

  if (NATIVE_IDES.includes(ideName)) {
    return vscode.version;
  }

  // Fork: tenta ler versão real do package.json da instalação
  try {
    const execDir = path.dirname(process.execPath);
    const pkgPath = path.join(execDir, 'resources', 'app', 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.version) {
        return pkg.version as string;
      }
    }
  } catch {
    // ignora erro — usa fallback abaixo
  }

  return `${vscode.version}-base`;
}
