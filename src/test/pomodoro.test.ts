import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseManager, PomodoroConfig, PomodoroSession } from '../modules/database';

suite('Pomodoro Database Tests', () => {
    let databaseManager: DatabaseManager;
    let tempDbPath: string;

    setup(async () => {
        // Criar diretório temporário para testes
        tempDbPath = path.join(__dirname, '..', '..', 'test-temp', 'pomodoro-tests');
        if (!fs.existsSync(tempDbPath)) {
            fs.mkdirSync(tempDbPath, { recursive: true });
        }

        databaseManager = new DatabaseManager();
        await databaseManager.initialize(tempDbPath);
    });

    teardown(async () => {
        await databaseManager.close();
        
        // Limpar arquivos de teste
        const dbFile = path.join(tempDbPath, 'time_tracker.sqlite');
        if (fs.existsSync(dbFile)) {
            fs.unlinkSync(dbFile);
        }
        if (fs.existsSync(tempDbPath)) {
            fs.rmdirSync(tempDbPath, { recursive: true });
        }
    });

    test('Deve criar e recuperar configuração do Pomodoro', async () => {
        const config: PomodoroConfig = {
            focusDuration: 45,
            shortBreakDuration: 15,
            longBreakDuration: 30,
            sessionsUntilLongBreak: 4,
            autoStartBreaks: true,
            autoStartFocus: false,
            enableSoundAlerts: true,
            enableDesktopNotifications: true,
            enableStatusBarTimer: true,
            dailyGoalSessions: 8
        };

        // Salvar configuração
        await databaseManager.savePomodoroConfig(config);

        // Recuperar configuração
        const retrievedConfig = await databaseManager.getPomodoroConfig();
        
        assert.strictEqual(retrievedConfig?.focusDuration, 45);
        assert.strictEqual(retrievedConfig?.shortBreakDuration, 15);
        assert.strictEqual(retrievedConfig?.longBreakDuration, 30);
        assert.strictEqual(retrievedConfig?.sessionsUntilLongBreak, 4);
        assert.strictEqual(retrievedConfig?.autoStartBreaks, true);
        assert.strictEqual(retrievedConfig?.autoStartFocus, false);
        assert.strictEqual(retrievedConfig?.enableSoundAlerts, true);
        assert.strictEqual(retrievedConfig?.enableDesktopNotifications, true);
        assert.strictEqual(retrievedConfig?.enableStatusBarTimer, true);
        assert.strictEqual(retrievedConfig?.dailyGoalSessions, 8);
    });

    test('Deve atualizar configuração existente do Pomodoro', async () => {
        const initialConfig: PomodoroConfig = {
            focusDuration: 25,
            shortBreakDuration: 5,
            longBreakDuration: 15,
            sessionsUntilLongBreak: 4,
            autoStartBreaks: false,
            autoStartFocus: false,
            enableSoundAlerts: false,
            enableDesktopNotifications: false,
            enableStatusBarTimer: false,
            dailyGoalSessions: 6
        };

        // Salvar configuração inicial
        await databaseManager.savePomodoroConfig(initialConfig);

        const updatedConfig: PomodoroConfig = {
            focusDuration: 45,
            shortBreakDuration: 15,
            longBreakDuration: 30,
            sessionsUntilLongBreak: 3,
            autoStartBreaks: true,
            autoStartFocus: true,
            enableSoundAlerts: true,
            enableDesktopNotifications: true,
            enableStatusBarTimer: true,
            dailyGoalSessions: 10
        };

        // Atualizar configuração
        await databaseManager.savePomodoroConfig(updatedConfig);

        // Verificar se foi atualizada
        const retrievedConfig = await databaseManager.getPomodoroConfig();
        
        assert.strictEqual(retrievedConfig?.focusDuration, 45);
        assert.strictEqual(retrievedConfig?.shortBreakDuration, 15);
        assert.strictEqual(retrievedConfig?.longBreakDuration, 30);
        assert.strictEqual(retrievedConfig?.sessionsUntilLongBreak, 3);
        assert.strictEqual(retrievedConfig?.autoStartBreaks, true);
        assert.strictEqual(retrievedConfig?.autoStartFocus, true);
        assert.strictEqual(retrievedConfig?.dailyGoalSessions, 10);
    });

    test('Deve salvar e recuperar sessão Pomodoro', async () => {
        const session: PomodoroSession = {
            sessionType: 'focus',
            plannedDuration: 2700, // 45 minutos em segundos
            actualDuration: 2700,
            startTime: Math.floor(Date.now() / 1000),
            endTime: Math.floor(Date.now() / 1000) + 2700,
            wasCompleted: true,
            wasInterrupted: false,
            associatedActivity: 'Desenvolvimento VSCode Extension',
            productivityRating: 8,
            notes: 'Sessão produtiva implementando Pomodoro'
        };

        // Salvar sessão
        const sessionId = await databaseManager.savePomodoroSession(session);
        assert.ok(sessionId > 0);

        // Recuperar sessões
        const sessions = await databaseManager.getPomodoroSessions();
        assert.strictEqual(sessions.length, 1);
        
        const retrievedSession = sessions[0];
        assert.strictEqual(retrievedSession.id, sessionId);
        assert.strictEqual(retrievedSession.sessionType, 'focus');
        assert.strictEqual(retrievedSession.plannedDuration, 2700);
        assert.strictEqual(retrievedSession.actualDuration, 2700);
        assert.strictEqual(retrievedSession.wasCompleted, true);
        assert.strictEqual(retrievedSession.wasInterrupted, false);
        assert.strictEqual(retrievedSession.associatedActivity, 'Desenvolvimento VSCode Extension');
        assert.strictEqual(retrievedSession.productivityRating, 8);
        assert.strictEqual(retrievedSession.notes, 'Sessão produtiva implementando Pomodoro');
    });

    test('Deve filtrar sessões por tipo', async () => {
        const focusSession: PomodoroSession = {
            sessionType: 'focus',
            plannedDuration: 2700,
            startTime: Math.floor(Date.now() / 1000),
            wasCompleted: true,
            wasInterrupted: false
        };

        const breakSession: PomodoroSession = {
            sessionType: 'short_break',
            plannedDuration: 900,
            startTime: Math.floor(Date.now() / 1000) + 3600,
            wasCompleted: true,
            wasInterrupted: false
        };

        // Salvar sessões
        await databaseManager.savePomodoroSession(focusSession);
        await databaseManager.savePomodoroSession(breakSession);

        // Filtrar por tipo focus
        const focusSessions = await databaseManager.getPomodoroSessions(undefined, undefined, 'focus');
        assert.strictEqual(focusSessions.length, 1);
        assert.strictEqual(focusSessions[0].sessionType, 'focus');

        // Filtrar por tipo short_break
        const breakSessions = await databaseManager.getPomodoroSessions(undefined, undefined, 'short_break');
        assert.strictEqual(breakSessions.length, 1);
        assert.strictEqual(breakSessions[0].sessionType, 'short_break');
    });

    test('Deve atualizar sessão Pomodoro existente', async () => {
        const session: PomodoroSession = {
            sessionType: 'focus',
            plannedDuration: 2700,
            startTime: Math.floor(Date.now() / 1000),
            wasCompleted: false,
            wasInterrupted: false
        };

        // Salvar sessão
        const sessionId = await databaseManager.savePomodoroSession(session);

        // Atualizar sessão
        await databaseManager.updatePomodoroSession(sessionId, {
            actualDuration: 2400, // 40 minutos
            endTime: Math.floor(Date.now() / 1000) + 2400,
            wasCompleted: true,
            productivityRating: 7,
            notes: 'Finalizada com sucesso'
        });

        // Verificar atualização
        const sessions = await databaseManager.getPomodoroSessions();
        const updatedSession = sessions.find(s => s.id === sessionId);
        
        assert.ok(updatedSession);
        assert.strictEqual(updatedSession.actualDuration, 2400);
        assert.strictEqual(updatedSession.wasCompleted, true);
        assert.strictEqual(updatedSession.productivityRating, 7);
        assert.strictEqual(updatedSession.notes, 'Finalizada com sucesso');
    });

    test('Deve retornar null quando não há configuração Pomodoro', async () => {
        const config = await databaseManager.getPomodoroConfig();
        assert.strictEqual(config, null);
    });

    test('Deve retornar array vazio quando não há sessões Pomodoro', async () => {
        const sessions = await databaseManager.getPomodoroSessions();
        assert.strictEqual(sessions.length, 0);
    });
});
