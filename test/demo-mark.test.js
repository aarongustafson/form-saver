import { readFile, readdir } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('marks component tags in displayed demo code', async () => {
	const { name } = JSON.parse(await readFile('package.json', 'utf8'));
	const tag = name.split('/').pop();
	const signature = new RegExp(
		`</?${tag}(?=[\\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>`,
		'gi',
	);
	for (const file of await readdir('demo', { recursive: true })) {
		if (!file.endsWith('.html')) continue;
		const template = document.createElement('template');
		template.innerHTML = await readFile(`demo/${file}`, 'utf8');
		for (const code of template.content.querySelectorAll('pre code')) {
			const marked = [...code.querySelectorAll('mark')].map((mark) => {
				const range = document.createRange();
				range.selectNodeContents(code);
				range.setEndBefore(mark);
				const start = range.toString().length;
				return [start, start + mark.textContent.length];
			});
			for (const match of code.textContent.matchAll(signature)) {
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
});
