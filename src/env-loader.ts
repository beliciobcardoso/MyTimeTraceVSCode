import * as dotenv from 'dotenv';
import * as path from 'path';

// Carrega .env da raiz da extensão antes de qualquer módulo ler process.env
dotenv.config({ path: path.join(__dirname, '../.env') });
