import * as os from 'os';

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
