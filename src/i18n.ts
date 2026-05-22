import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// This file compiles to out/i18n.js → __dirname = {extensionRoot}/out/
const EXT_ROOT = path.join(__dirname, '..');

let bundle: Record<string, string> | null = null;

function getBundle(): Record<string, string> {
  if (bundle !== null) { return bundle; }

  const locale = vscode.env.language.toLowerCase();
  const candidates = [
    path.join(EXT_ROOT, `package.nls.${locale}.json`),
    path.join(EXT_ROOT, `package.nls.${locale.split('-')[0]}.json`),
  ];

  for (const f of candidates) {
    try {
      bundle = JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, string>;
      return bundle;
    } catch { /* try next */ }
  }

  bundle = {};
  return bundle;
}

export function localize(key: string, defaultMessage: string, ...args: (string | number)[]): string {
  const msgs = getBundle();
  let msg = msgs[key] ?? defaultMessage;
  for (let i = 0; i < args.length; i++) {
    msg = msg.replace(`{${i}}`, String(args[i]));
  }
  return msg;
}
