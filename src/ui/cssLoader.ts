/**
 * CSS LOADER - MyTimeTrace VSCode
 * 
 * Funções auxiliares para carregar arquivos CSS externos
 * no contexto de webviews do VS Code.
 */

import * as fs from 'fs';
import * as path from 'path';

export class CssLoader {
  /**
   * Carrega o conteúdo de um arquivo CSS
   * @param cssFileName Nome do arquivo CSS (ex: 'dashboard-styles.css')
   * @param extensionPath Caminho base da extensão
   * @returns Conteúdo CSS como string
   */
  static loadCssFile(cssFileName: string, extensionPath: string): string {
    try {
      // Tentar múltiplos caminhos para compatibilidade com testes e produção
      const possiblePaths = [
        // PRIORIDADE: Caminho do diretório out (produção)
        path.join(__dirname, cssFileName),
        path.join(extensionPath, 'out', 'ui', cssFileName),
        // Caminho direto na fonte (desenvolvimento)
        path.join(extensionPath, 'src', 'ui', cssFileName),
        // Caminhos relativos ao __dirname (compilado)
        path.join(__dirname, '..', '..', 'src', 'ui', cssFileName),
        path.join(__dirname, '..', 'ui', cssFileName),
        // Caminhos para testes
        path.join(extensionPath, '..', 'src', 'ui', cssFileName),
        path.join(extensionPath, '..', '..', 'src', 'ui', cssFileName),
        // Caminho absoluto como fallback
        path.resolve(extensionPath, 'src', 'ui', cssFileName),
      ];

      for (const cssPath of possiblePaths) {
        if (fs.existsSync(cssPath)) {
          return fs.readFileSync(cssPath, 'utf8');
        }
      }
      
      console.warn(`⚠️ CSS file not found: ${cssFileName}. Tried paths:`, possiblePaths);
      return '';
    } catch (error) {
      console.error(`🚨 Error loading CSS file ${cssFileName}:`, error);
      return '';
    }
  }

  /**
   * Carrega estilos do dashboard moderno
   * @param extensionPath Caminho base da extensão
   * @returns CSS do dashboard como string
   */
  static loadDashboardStyles(extensionPath: string): string {
    return this.loadCssFile('dashboard-styles.css', extensionPath);
  }

  /**
   * Carrega estilos dos filtros
   * @param extensionPath Caminho base da extensão
   * @returns CSS dos filtros como string
   */
  static loadFiltersStyles(extensionPath: string): string {
    return this.loadCssFile('filters-styles.css', extensionPath);
  }

  /**
   * Formata CSS para inclusão em HTML
   * @param cssContent Conteúdo CSS
   * @returns CSS formatado dentro de tags <style>
   */
  static formatCssForHtml(cssContent: string): string {
    if (!cssContent.trim()) {
      return '';
    }
    
    return `<style>\n${cssContent}\n</style>`;
  }
}
