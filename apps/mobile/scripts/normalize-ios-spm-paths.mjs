import { readFile, writeFile } from 'node:fs/promises';

const packageFile = new URL('../ios/App/CapApp-SPM/Package.swift', import.meta.url);
const source = await readFile(packageFile, 'utf8');
const normalized = source.replace(/(\bpath:\s*")([^"]+)(")/g, (_match, start, value, end) =>
  `${start}${value.replace(/\\/g, '/')}${end}`,
);

if (normalized !== source) {
  await writeFile(packageFile, normalized);
  console.log('Normalized iOS Swift package paths for Xcode.');
}
