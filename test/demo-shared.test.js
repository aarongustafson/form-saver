import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { checkSharedFiles } from '../scripts/check-demo-shared.js';

it('verifies this checkout against its shared demo snapshot', () => {
	expect(() => checkSharedFiles(process.cwd())).not.toThrow();
});

it('validates an optional source pin without the workspace or network', async () => {
	const root = await mkdtemp(join(tmpdir(), 'demo-provenance-'));
	try {
		await mkdir(join(root, 'demo'));
		const source = 'pre { color: FieldText; }';
		const integrity = JSON.stringify({
			'demo/demo-shell.css': createHash('sha256')
				.update(source)
				.digest('hex'),
		});
		await writeFile(join(root, 'demo/demo-shell.css'), source);
		await writeFile(
			join(root, 'demo/shared-files.json'),
			JSON.stringify(['demo/demo-shell.css']),
		);
		await writeFile(join(root, 'demo/shared-integrity.json'), integrity);
		const record = {
			repository: 'aarongustafson/web-component-starter',
			revision: '0'.repeat(40),
			integrity: createHash('sha256').update(integrity).digest('hex'),
		};
		const path = join(root, 'demo/shared-source.json');
		await writeFile(path, JSON.stringify(record));
		expect(() => checkSharedFiles(root)).not.toThrow();
		for (const change of [
			{ integrity: '0'.repeat(64) },
			{ revision: 'main' },
			{ repository: 'other/starter' },
		]) {
			await writeFile(path, JSON.stringify({ ...record, ...change }));
			expect(() => checkSharedFiles(root)).toThrow(/source provenance/i);
		}
		await rm(path);
		await writeFile(join(root, 'outside.json'), JSON.stringify(record));
		await symlink(join(root, 'outside.json'), path);
		expect(() => checkSharedFiles(root)).toThrow(/symbolic link/i);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

it('rejects shared-file drift but permits component-local styles', async () => {
	const root = await mkdtemp(join(tmpdir(), 'demo-integrity-'));
	try {
		await mkdir(join(root, 'demo'));
		const source = 'pre { color: FieldText; }';
		await writeFile(
			join(root, 'demo/shared-files.json'),
			JSON.stringify(['demo/demo-shell.css']),
		);
		await writeFile(
			join(root, 'demo/shared-integrity.json'),
			JSON.stringify({
				'demo/demo-shell.css': createHash('sha256')
					.update(source)
					.digest('hex'),
			}),
		);
		await writeFile(join(root, 'demo/demo-shell.css'), source);
		await writeFile(
			join(root, 'demo/styles.css'),
			'.custom { padding: 1rem; }',
		);
		expect(() => checkSharedFiles(root)).not.toThrow();
		await writeFile(
			join(root, 'demo/demo-shell.css'),
			'pre { color: red; }',
		);
		expect(() => checkSharedFiles(root)).toThrow(/demo-shell\.css/);
		await rm(join(root, 'demo/demo-shell.css'));
		await writeFile(join(root, 'outside.css'), source);
		await symlink(
			join(root, 'outside.css'),
			join(root, 'demo/demo-shell.css'),
		);
		expect(() => checkSharedFiles(root)).toThrow(/symbolic link/i);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
