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
 * - Desenvolvimento: http://localhost:3000/api
 * - Produção: https://mytimetrace.com.br/api
 * 
 * @constant
 */
// Definir API_BASE_URL no ambiente antes de publicar (vsce package)
export const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api';

/**
 * Timeout padrão para requisições HTTP (ms)
 */
export const REQUEST_TIMEOUT = 30000; // 30 segundos

/**
 * Limite de entries por batch de sincronização
 */
export const SYNC_BATCH_LIMIT = 200;

/**
 * Horários padrão para auto-sync (HH:MM)
 * 
 * **Configurável via API:** /sync/config
 * **Padrão:** 3x por dia (manhã, meio-dia e tarde)
 */
export const SYNC_DEFAULT_TIMES = ['08:00', '12:00', '17:00'];

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

// ========================================
// 🗄️ Backup automático
// ========================================

/** Retenção mínima de backups (nunca remover abaixo deste número) */
export const BACKUP_MIN_RETENTION = 3;

/** Intervalo padrão entre backups em horas */
export const BACKUP_DEFAULT_INTERVAL_HOURS = 24;

/** Número máximo de tentativas de retry em caso de falha */
export const BACKUP_MAX_RETRIES = 3;

/** Delay entre tentativas de retry em ms */
export const BACKUP_RETRY_DELAY_MS = 30_000; // 30 segundos

/** Delay inicial antes do primeiro backup após ativação da extensão */
export const BACKUP_INITIAL_DELAY = 5_000; // 5 segundos

/** Gap em dias que dispara alerta de backup não realizado há muito tempo */
export const BACKUP_ALERT_GAP_DAYS = 7;
