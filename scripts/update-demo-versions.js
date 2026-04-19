#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read the current version from package.json
const packageJson = JSON.parse(
	readFileSync(join(rootDir, 'package.json'), 'utf-8'),
);
const version = packageJson.version;
const packageName = packageJson.name;

// Update esm.html
const esmPath = join(rootDir, 'demo', 'esm.html');
let esmContent = readFileSync(esmPath, 'utf-8');

// Replace version in the esm.sh URL
esmContent = esmContent.replace(
	new RegExp(`${packageName}@[\\d.]+\\/`, 'g'),
	`${packageName}@${version}/`,
);

writeFileSync(esmPath, esmContent, 'utf-8');

console.log(`✓ Updated demo/esm.html to version ${version}`);
