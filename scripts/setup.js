#!/usr/bin/env node

/**
 * Interactive setup script for web-component-starter template
 * This script helps users quickly set up their new web component project
 */

import {
	readFileSync,
	writeFileSync,
	renameSync,
	unlinkSync,
	existsSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

function question(query) {
	return new Promise((resolve) => rl.question(query, resolve));
}

function kebabToPascal(str) {
	return str
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join('');
}

function replaceInFile(filePath, replacements) {
	try {
		let content = readFileSync(filePath, 'utf8');
		replacements.forEach(([search, replace]) => {
			content = content.split(search).join(replace);
		});
		writeFileSync(filePath, content, 'utf8');
		return true;
	} catch (error) {
		console.error(`Error updating ${filePath}:`, error.message);
		return false;
	}
}

async function main() {
	console.log('\n🚀 Web Component Starter - Setup Wizard\n');
	console.log('This wizard will help you set up your new web component.\n');

	// Get component name
	const componentName = await question(
		'Component name (kebab-case, e.g., my-awesome-component): ',
	);

	if (
		!componentName ||
		!/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(componentName)
	) {
		console.error(
			'\n❌ Invalid component name. Must be kebab-case with at least one hyphen.',
		);
		rl.close();
		process.exit(1);
	}

	// Generate class name
	const className = kebabToPascal(componentName) + 'Element';

	// Get component description
	const description = await question('\nComponent description: ');

	if (!description) {
		console.error('\n❌ Description is required.');
		rl.close();
		process.exit(1);
	}

	rl.close();

	console.log('\n📝 Setting up your component...\n');

	const replacements = [
		['COMPONENT-NAME', componentName],
		['ComponentNameElement', className],
		['COMPONENT_DESCRIPTION', description],
	];

	// Files to update
	const filesToUpdate = [
		'package.json',
		'index.js',
		'define.js',
		'custom-elements.json',
		'test/setup.js',
		'demo/index.html',
		'CONTRIBUTING.md',
	];

	// Update file contents
	console.log('Updating files...');
	filesToUpdate.forEach((file) => {
		const filePath = join(projectRoot, file);
		if (existsSync(filePath)) {
			replaceInFile(filePath, replacements);
			console.log(`  ✓ ${file}`);
		}
	});

	// Generate README from template
	console.log('Generating README from template...');
	const templatePath = join(projectRoot, 'README.tpl');
	const readmePath = join(projectRoot, 'README.md');
	if (existsSync(templatePath)) {
		let readmeContent = readFileSync(templatePath, 'utf8');
		replacements.forEach(([search, replace]) => {
			readmeContent = readmeContent.split(search).join(replace);
		});
		writeFileSync(readmePath, readmeContent, 'utf8');
		console.log(`  ✓ Generated README.md from template`);
	}

	// Rename main component file
	const oldComponentPath = join(projectRoot, 'COMPONENT-NAME.js');
	const newComponentPath = join(projectRoot, `${componentName}.js`);
	if (existsSync(oldComponentPath)) {
		renameSync(oldComponentPath, newComponentPath);
		console.log(`  ✓ Renamed COMPONENT-NAME.js → ${componentName}.js`);
	}

	// Update the renamed component file
	replaceInFile(newComponentPath, replacements);

	// Rename test file
	const oldTestPath = join(projectRoot, 'test/COMPONENT-NAME.test.js');
	const newTestPath = join(projectRoot, `test/${componentName}.test.js`);
	if (existsSync(oldTestPath)) {
		renameSync(oldTestPath, newTestPath);
		console.log(`  ✓ Renamed test file → test/${componentName}.test.js`);
	}

	// Update the renamed test file
	replaceInFile(newTestPath, replacements);

	// Clean up template files
	console.log('\nCleaning up template files...');
	const filesToRemove = ['SETUP.md', 'README.tpl', 'scripts/setup.js'];

	filesToRemove.forEach((file) => {
		const filePath = join(projectRoot, file);
		if (existsSync(filePath)) {
			unlinkSync(filePath);
			console.log(`  ✓ Removed ${file}`);
		}
	});

	// Remove the scripts directory if it's now empty
	const scriptsDir = join(projectRoot, 'scripts');
	try {
		const files = require('fs').readdirSync(scriptsDir);
		if (files.length === 0) {
			require('fs').rmdirSync(scriptsDir);
			console.log(`  ✓ Removed empty scripts/ directory`);
		}
	} catch (error) {
		// Directory doesn't exist or couldn't be read, that's fine
	}

	// Install dependencies
	console.log('\n📦 Installing dependencies...\n');
	try {
		execSync('npm install', { cwd: projectRoot, stdio: 'inherit' });
	} catch (error) {
		console.error(
			'\n⚠️  Failed to install dependencies. Please run npm install manually.',
		);
	}

	// Initialize git
	console.log('\n🔧 Initializing git repository...\n');
	try {
		if (!existsSync(join(projectRoot, '.git'))) {
			execSync('git init', { cwd: projectRoot, stdio: 'inherit' });
			execSync('git add .', { cwd: projectRoot, stdio: 'inherit' });
			execSync(`git commit -m "Initial commit: ${componentName}"`, {
				cwd: projectRoot,
				stdio: 'inherit',
			});
		}
	} catch (error) {
		console.error(
			'\n⚠️  Failed to initialize git. You can do this manually later.',
		);
	}

	console.log('\n✨ Setup complete!\n');
	console.log(`Your component "${componentName}" is ready to go!\n`);
	console.log('Next steps:');
	console.log(`  1. Edit ${componentName}.js to implement your component`);
	console.log(`  2. Add tests to test/${componentName}.test.js`);
	console.log('  3. Run "npm test" to run tests in watch mode');
	console.log('  4. Run "npm run format" to format your code');
	console.log('  5. Update README.md with your component documentation\n');
	console.log('📦 Publishing Setup:\n');
	console.log(
		'  Before you can publish to npm via GitHub Actions, you need to:',
	);
	console.log('  1. Publish your package to npm at least once manually');
	console.log('  2. Configure OIDC for automated publishing');
	console.log(
		'  3. Visit your package on npm and go to Settings > Publishing Access',
	);
	console.log(
		'     (https://www.npmjs.com/package/@yourscope/your-package-name/access)',
	);
	console.log(
		'  4. Under "Publishing Access", add GitHub Actions as a trusted publisher',
	);
	console.log('  5. Set up with your repository details\n');
	console.log('  See README.md for detailed publishing instructions.\n');
}

main().catch((error) => {
	console.error('\n❌ Setup failed:', error.message);
	rl.close();
	process.exit(1);
});
