import { readFile } from 'node:fs/promises';

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
];

let contents;
try {
  contents = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  console.error('Falta ledger/.env.local. Cópialo desde .env.example y completa Firebase Console antes de publicar.');
  process.exitCode = 1;
}

if (contents !== undefined) {
  const configured = new Set(
    contents.split(/\r?\n/)
      .map((line) => line.match(/^\s*(VITE_FIREBASE_[A-Z_]+)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .filter(([, , value]) => value && !value.startsWith('#'))
      .map(([, key]) => key),
  );
  const missing = required.filter((key) => !configured.has(key));
  if (missing.length) {
    console.error(`Completa estas variables en ledger/.env.local antes de publicar:\n${missing.join('\n')}`);
    process.exitCode = 1;
  }
}
