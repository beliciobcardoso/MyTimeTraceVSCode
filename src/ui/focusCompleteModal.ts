/**
 * Modal específico para alerta de fim de período de foco
 * Aparece após 45 minutos de codificação contínua
 */

import { ModalManager } from '../modules/modal';
import { PomodoroManager } from '../modules/pomodoro';
import * as vscode from 'vscode';

export interface FocusCompleteModalOptions {
    focusDuration: number;      // Duração do foco em minutos
    canContinue: boolean;       // Se pode continuar por mais tempo
    continueMinutes: number;    // Quantos minutos extras pode continuar
}

export class FocusCompleteModal {
    private static instance: FocusCompleteModal | null = null;
    private modalManager: ModalManager;
    private pomodoroManager: PomodoroManager | null = null;
    private currentModalId: string | null = null;

    private constructor() {
        this.modalManager = ModalManager.getInstance();
    }

    public static getInstance(): FocusCompleteModal {
        if (!FocusCompleteModal.instance) {
            FocusCompleteModal.instance = new FocusCompleteModal();
        }
        return FocusCompleteModal.instance;
    }

    /**
     * Inicializa com referência ao PomodoroManager
     */
    public initialize(pomodoroManager: PomodoroManager): void {
        this.pomodoroManager = pomodoroManager;
    }

    /**
     * Exibe o modal de alerta de fim de foco
     */
    public async showFocusCompleteAlert(options: FocusCompleteModalOptions): Promise<void> {
        // Se já há um modal ativo, não abre outro
        if (this.currentModalId && this.modalManager.isModalActive(this.currentModalId)) {
            return;
        }

        const modalId = 'focus-complete-alert';
        this.currentModalId = modalId;

        // Reproduzir som de alerta
        await this.playAlertSound();

        const content = this.generateModalContent(options);

        await this.modalManager.showModal({
            id: modalId,
            title: '🔔 Hora de uma pausa!',
            content: content,
            width: '600px',
            height: '550px',
            className: 'modal-focus-alert',
            closable: false, // Forçar usuário a escolher uma opção
            buttons: [
                {
                    id: 'take-break',
                    text: '🧘 Relaxar agora (15 min)',
                    className: 'modal-button primary break-button',
                    onClick: () => this.handleTakeBreak()
                },
                {
                    id: 'continue-focus',
                    text: `⏰ Continuar por mais ${options.continueMinutes} min`,
                    className: 'modal-button secondary continue-button',
                    onClick: () => this.handleContinueFocus(options.continueMinutes)
                },
                {
                    id: 'open-settings',
                    text: '⚙️ Configurações',
                    className: 'modal-button tertiary settings-button',
                    onClick: () => this.handleOpenSettings()
                }
            ]
        }, {
            onShow: () => {
                // Fazer blink no status bar para chamar atenção
                this.startStatusBarBlink();
            },
            onDestroy: () => {
                this.currentModalId = null;
                this.stopStatusBarBlink();
            }
        });
    }

    /**
     * Gera o conteúdo HTML do modal
     */
    private generateModalContent(options: FocusCompleteModalOptions): string {
        const focusTime = this.formatDuration(options.focusDuration);
        
        return `
            <div class="focus-alert-container">
                <div class="alert-icon">
                    <span class="icon-large">⏰</span>
                </div>
                
                <div class="alert-message">
                    <h2>Excelente foco!</h2>
                    <p class="focus-duration">Você codificou por <strong>${focusTime}</strong> consecutivos</p>
                    <p class="recommendation">
                        Para manter sua produtividade e saúde, recomendamos uma pausa de 15 minutos.
                    </p>
                </div>

                <div class="benefits-section">
                    <h3>🧠 Benefícios da pausa:</h3>
                    <ul class="benefits-list">
                        <li>Descansa os olhos e previne fadiga visual</li>
                        <li>Melhora a criatividade e resolução de problemas</li>
                        <li>Aumenta o foco para a próxima sessão</li>
                        <li>Reduz o estresse e melhora o bem-estar</li>
                    </ul>
                </div>

                <div class="action-prompt">
                    <p><strong>O que você gostaria de fazer?</strong></p>
                </div>
                
                <div style="margin-top: 30px;"></div>
            </div>
        `;
    }

    /**
     * Ação: Iniciar pausa de 15 minutos
     */
    private async handleTakeBreak(): Promise<void> {
        if (!this.pomodoroManager) {
            vscode.window.showErrorMessage('PomodoroManager não inicializado');
            return;
        }

        try {
            await this.pomodoroManager.startBreakSession('short');
            this.closeModal();
            
            // Mostrar notificação de confirmação
            vscode.window.showInformationMessage(
                '✅ Pausa iniciada! Relaxe por 15 minutos. Você merece! 😌'
            );

            // Opcional: Abrir sugestões de atividades para a pausa
            this.showBreakSuggestions();

        } catch (error) {
            console.error('Erro ao iniciar pausa:', error);
            vscode.window.showErrorMessage('Erro ao iniciar pausa. Tente novamente.');
        }
    }

    /**
     * Ação: Continuar foco por mais X minutos
     */
    private async handleContinueFocus(extraMinutes: number): Promise<void> {
        if (!this.pomodoroManager) {
            vscode.window.showErrorMessage('PomodoroManager não inicializado');
            return;
        }

        try {
            await this.pomodoroManager.extendFocus(extraMinutes);
            this.closeModal();
            
            vscode.window.showInformationMessage(
                `⏱️ Foco estendido por mais ${extraMinutes} minutos. Mantenha o ritmo! 💪`
            );

        } catch (error) {
            console.error('Erro ao estender foco:', error);
            vscode.window.showErrorMessage('Erro ao estender tempo de foco. Tente novamente.');
        }
    }

    /**
     * Ação: Abrir configurações do Pomodoro
     */
    private async handleOpenSettings(): Promise<void> {
        try {
            // Fechar modal atual
            this.closeModal();
            
            // Abrir configurações via comando VSCode
            await vscode.commands.executeCommand('my-time-trace-vscode.showPomodoroConfig');
            
        } catch (error) {
            console.error('Erro ao abrir configurações:', error);
            // Se comando não existir, mostrar mensagem informativa
            vscode.window.showInformationMessage(
                '⚙️ Configurações do Pomodoro em desenvolvimento. Use as configurações do VSCode por enquanto.',
                'Abrir Configurações VSCode'
            ).then(selection => {
                if (selection === 'Abrir Configurações VSCode') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'myTimeTraceVSCode');
                }
            });
        }
    }

    /**
     * Reproduz som de alerta
     */
    private async playAlertSound(): Promise<void> {
        try {
            // Usar API nativa do VSCode para reproduzir som
            // Nota: VSCode não tem API de áudio nativa, mas podemos usar HTML5 Audio no webview
            console.log('🔊 Reproduzindo som de alerta...');
            
            // Implementar som via webview HTML5 audio na próxima sub-tarefa
            
        } catch (error) {
            console.error('Erro ao reproduzir som:', error);
        }
    }

    /**
     * Inicia efeito visual de alerta (usando notificações VSCode)
     */
    private statusBarBlinkInterval: NodeJS.Timeout | null = null;

    private startStatusBarBlink(): void {
        // Usar notificações do VSCode para chamar atenção
        let blinkCount = 0;
        this.statusBarBlinkInterval = setInterval(() => {
            if (blinkCount < 6) { // Blink por 6 vezes (3 segundos)
                const message = blinkCount % 2 === 0 ? 
                    '🔴 Hora de uma pausa!' : 
                    '⏰ 45 minutos de foco completos';
                
                // Não usar showInformationMessage para não spam
                console.log(`Status blink: ${message}`);
                blinkCount++;
            } else {
                this.stopStatusBarBlink();
            }
        }, 500);
    }

    private stopStatusBarBlink(): void {
        if (this.statusBarBlinkInterval) {
            clearInterval(this.statusBarBlinkInterval);
            this.statusBarBlinkInterval = null;
        }
    }

    /**
     * Mostra sugestões de atividades para a pausa
     */
    private showBreakSuggestions(): void {
        const suggestions = [
            '🚶 Faça uma caminhada rápida',
            '💧 Beba um copo d\'água',
            '🧘 Pratique respiração profunda',
            '👁️ Olhe para longe por 30 segundos',
            '🤸 Faça alongamentos simples',
            '☕ Prepare um café ou chá',
            '🌱 Regue suas plantas',
            '📱 Verifique mensagens importantes'
        ];

        const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
        
        setTimeout(() => {
            vscode.window.showInformationMessage(
                `💡 Sugestão para sua pausa: ${randomSuggestion}`,
                'OK', 'Mais sugestões'
            ).then(selection => {
                if (selection === 'Mais sugestões') {
                    this.showBreakSuggestions();
                }
            });
        }, 2000);
    }

    /**
     * Fecha o modal atual
     */
    private closeModal(): void {
        if (this.currentModalId) {
            this.modalManager.closeModal(this.currentModalId);
            this.currentModalId = null;
        }
    }

    /**
     * Formata duração em minutos para string legível
     */
    private formatDuration(minutes: number): string {
        if (minutes < 60) {
            return `${minutes} minutos`;
        }
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (remainingMinutes === 0) {
            return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
        }
        
        return `${hours}h ${remainingMinutes}min`;
    }

    /**
     * Verifica se o modal está atualmente ativo
     */
    public isActive(): boolean {
        return this.currentModalId !== null && 
               this.modalManager.isModalActive(this.currentModalId);
    }

    /**
     * Força fechamento do modal (para casos de emergência)
     */
    public forceClose(): void {
        this.closeModal();
        this.stopStatusBarBlink();
    }
}