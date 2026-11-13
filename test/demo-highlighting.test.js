import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
	copyFileSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { describe, expect, it } from 'vitest';

const original = {
	index: [
		'96903f6f6622f59080ea27fb445c390a8908c12bd43f0cfc1790cd44b81ce872',
		'33e3e08ca8bbc3c3c1a40b4d9052b543fbd21a13d050162b7a8aa7d75095a166',
		'a9bb3edc286ce74c14d18fbd9fdae95bd17440e45f32a32f1aed8659daf608e4',
		'741cfaa8f2efdeede421e3bb42c5faf0870fe4c1c52d5504d970534d78da83ad',
		'47a489320a0a9d5a24723ec6966d853a2bdac430914a414871ec5f7c4214e6bc',
	],
	esm: ['dea8158bf8d55d21739184fc68b4d78ba86a7d35ca88a9ef8d83ff08ddbdb0a7'],
	unpkg: ['a13c3aa76a36ea1cd5fe705caabdc95faf6a95f555f8212999fab883e0479337'],
};
const snippets =
	/<\/?form-saver\b[^>]*>|import\b[\s\S]*?;|customElements\.define\([^)]*\);|defineComponentName\(\);/g;
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const hash = (text, pkg = manifest) =>
	createHash('sha256')
		.update(
			text.replaceAll(
				`https://esm.sh/${pkg.name}@${pkg.version}/`,
				`https://esm.sh/${pkg.name}@VERSION/`,
			),
		)
		.digest('hex');

describe('displayed component code', () => {
	it('accepts a future version written by the retained publishing helper', () => {
		const fixture = `test/.demo-version-${process.pid}`;
		try {
			mkdirSync(`${fixture}/scripts`, { recursive: true });
			mkdirSync(`${fixture}/demo`);
			const future = { ...manifest, version: '99.12.3' };
			writeFileSync(`${fixture}/package.json`, JSON.stringify(future));
			copyFileSync('demo/esm.html', `${fixture}/demo/esm.html`);
			copyFileSync(
				'scripts/update-demo-versions.js',
				`${fixture}/scripts/update-demo-versions.js`,
			);
			execFileSync(process.execPath, [
				`${fixture}/scripts/update-demo-versions.js`,
			]);
			const html = readFileSync(`${fixture}/demo/esm.html`, 'utf8');
			expect(
				html.split(`${future.name}@${future.version}/`),
			).toHaveLength(3);
			const template = document.createElement('template');
			template.innerHTML = html;
			expect(
				hash(
					template.content.querySelector('pre code').textContent,
					future,
				),
			).toBe(original.esm[0]);
		} finally {
			rmSync(fixture, { recursive: true, force: true });
		}
	});

	it.each(Object.keys(original))(
		'%s marks each component snippet without changing copyable text',
		(name) => {
			const template = document.createElement('template');
			template.innerHTML = readFileSync(`demo/${name}.html`, 'utf8');
			const blocks = [...template.content.querySelectorAll('pre code')];
			expect(blocks).toHaveLength(original[name].length);
			for (const [index, code] of blocks.entries()) {
				expect(hash(code.textContent)).toBe(original[name][index]);
				const expected = [...code.textContent.matchAll(snippets)].map(
					([text]) => text,
				);
				expect(expected.length).toBeGreaterThan(0);
				expect(
					[...code.querySelectorAll('mark')].map(
						(mark) => mark.textContent,
					),
				).toEqual(expected);
				expect(code.querySelector('mark mark')).toBeNull();
				expect(
					code.querySelectorAll(':scope > :not(mark)'),
				).toHaveLength(0);
			}
		},
	);
});
