import { defineConfig } from '@vscode/test-cli';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function loadDotEnv(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const vars = {};
    for (const line of content.split('\n')) {
      const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) { vars[match[1]] = match[2].trim(); }
    }
    return vars;
  } catch {
    return {};
  }
}

const envVars = loadDotEnv(resolve(__dirname, '.env'));

export default defineConfig({
  files: 'out/test/**/*.test.js',
  env: envVars,
});
