import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file) => readFileSync(file, 'utf8');

describe('retained publishing contracts', () => {
	it('keeps the version updater, staging, and push automation', () => {
		const pkg = JSON.parse(read('package.json'));
		expect(pkg.scripts.version).toBe(
			'node scripts/update-demo-versions.js && git add demo/esm.html',
		);
		expect(pkg.scripts.postversion).toBe('git push --follow-tags');
		const before = read('demo/esm.html');
		execFileSync(process.execPath, ['scripts/update-demo-versions.js']);
		expect(read('demo/esm.html')).toBe(before);
		expect(before).toContain(`${pkg.name}@${pkg.version}/form-saver.js`);
		expect(read('.github/workflows/publish.yml')).toContain('npm publish');
	});

	it('keeps package exports and the published runtime/API files aligned', () => {
		const pkg = JSON.parse(read('package.json'));
		for (const file of [
			'form-saver.js',
			'form-saver.d.ts',
			'index.js',
			'define.js',
			'custom-elements.json',
		]) {
			expect(pkg.files).toContain(file);
			expect(read(file).length).toBeGreaterThan(0);
		}
		expect(pkg.exports['.'].import).toBe('./index.js');
		expect(pkg.exports['./form-saver.js'].import).toBe('./form-saver.js');
		expect(pkg.exports['.'].types).toBe('./form-saver.d.ts');
	});
});
