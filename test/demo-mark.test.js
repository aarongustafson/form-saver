import { readFile, readdir } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('marks displayed component tags without highlighting inline code', async () => {
	const { name } = JSON.parse(await readFile('package.json', 'utf8'));
	const tag = name.split('/').pop();
	const signature = new RegExp(
		`</?${tag}(?=[\\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>`,
		'gi',
	);
	let pagesChecked = 0;
	let tagsChecked = 0;
	for (const file of await readdir('demo', { recursive: true })) {
		if (!file.endsWith('.html')) continue;
		pagesChecked += 1;
		const template = document.createElement('template');
		template.innerHTML = await readFile(`demo/${file}`, 'utf8');
		for (const code of template.content.querySelectorAll('code')) {
			if (!code.closest('pre')) {
				expect(
					code.querySelector('mark') ?? code.closest('mark'),
					`${file}: keep inline code unhighlighted (${code.textContent})`,
				).toBeNull();
				continue;
			}
			const marked = [...code.querySelectorAll('mark')].map((mark) => {
				const range = document.createRange();
				range.selectNodeContents(code);
				range.setEndBefore(mark);
				const start = range.toString().length;
				return [start, start + mark.textContent.length];
			});
			for (const match of code.textContent.matchAll(signature)) {
				tagsChecked += 1;
				expect(
					marked.some(
						([start, end]) =>
							start <= match.index &&
							end >= match.index + match[0].length,
					),
					`${file}: wrap ${match[0]} in mark`,
				).toBe(true);
			}
		}
	}
	expect(pagesChecked, 'Check at least one HTML demo page').toBeGreaterThan(
		0,
	);
	expect(
		tagsChecked,
		'Check at least one displayed component tag across the demos',
	).toBeGreaterThan(0);
	console.info(
		`Checked ${pagesChecked} demo pages and ${tagsChecked} displayed component tags.`,
	);
});
