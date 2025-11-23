/**
 * 🌐 Configurações Globais
 * 
 * Centralizador de constantes compartilhadas entre módulos.
 * Altere apenas aqui para refletir em toda a extensão.
 */

/**
 * URL base da API backend
 * 
 * **Ambientes:**
 * - Desenvolvimento: http://localhost:8989
 * - Produção: https://api.mytimetrace.com
 * 
 * @constant
 */
export const API_BASE_URL = 'http://localhost:8989';

/**
 * Timeout padrão para requisições HTTP (ms)
 */
export const REQUEST_TIMEOUT = 30000; // 30 segundos

/**
 * Limite de entries por batch de sincronização
 */
export const SYNC_BATCH_LIMIT = 100;

/**
 * Chaves do SecretStorage
 */
export const SECRET_KEYS = {
  API_KEY: 'mytimetrace.apiKey',
  DEVICE_KEY: 'mytimetrace.deviceKey'
} as const;

/**
 * Intervalo de limpeza automática de projetos expirados
 * @default 24 horas (86400000 ms)
 */
export const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas em ms

/**
 * Delay inicial antes do primeiro cleanup
 * @default 5 minutos (300000 ms)
 */
export const CLEANUP_INITIAL_DELAY = 5 * 60 * 1000; // 5 minutos
