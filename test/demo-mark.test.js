import { readFile, readdir } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('marks component tags in displayed demo code', async () => {
	const { name } = JSON.parse(await readFile('package.json', 'utf8'));
	const tag = name.split('/').pop();
	const signature = new RegExp(`</?${tag}(?=[\\s/>])`, 'i');
	for (const file of await readdir('demo', { recursive: true })) {
		if (!file.endsWith('.html')) continue;
		const template = document.createElement('template');
		template.innerHTML = await readFile(`demo/${file}`, 'utf8');
		for (const code of template.content.querySelectorAll('pre code')) {
			const unmarked = code.cloneNode(true);
			for (const mark of unmarked.querySelectorAll('mark')) mark.remove();
			expect(
				unmarked.textContent,
				`${file}: wrap ${tag} tags in mark`,
			).not.toMatch(signature);
		}
	}
});
