import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('identifies the component in the generated site-root page title', async () => {
	const workflow = await readFile('.github/workflows/pages.yml', 'utf8');
	const pkg = JSON.parse(await readFile('package.json', 'utf8'));
	const title = workflow.match(/<title>(.*?)<\/title>/s)?.[1];
	expect(title).toBe(pkg.name.split('/').pop());
});

it('trims block-edge margins inside demo sections', async () => {
	const styles = await readFile('demo/styles.css', 'utf8');
	expect(styles).toMatch(
		/\.demo-section(?:,\s*\.api-reference)?\s*\{[^}]*\bmargin-trim:\s*block;/,
	);
});
