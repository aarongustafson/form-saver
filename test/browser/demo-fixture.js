import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';

const root = new URL('../../', import.meta.url);
const distribution = new URL('node_modules/microlighter/dist/', root);
const cdn = 'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/';

export async function expectPairLayout(pair, width) {
	await expect(pair.locator(':scope > :first-child')).toBeVisible();
	await expect(pair.locator(':scope > .demo')).toBeVisible();
	const layout = await pair.evaluate((element) => {
		const code = element.firstElementChild.getBoundingClientRect();
		const demo = element
			.querySelector(':scope > .demo')
			.getBoundingClientRect();
		return {
			code: { right: code.right, bottom: code.bottom },
			demo: { x: demo.x, y: demo.y },
			overflow: document.documentElement.scrollWidth > window.innerWidth,
			columns: getComputedStyle(element)
				.gridTemplateColumns.replace(/\[[^\]]*\]/g, '')
				.trim()
				.split(/\s+/).length,
		};
	});
	expect(layout.overflow).toBe(false);
	if (width < 768) expect(layout.columns).toBe(1);
	if (layout.columns === 1)
		expect(layout.code.bottom).toBeLessThanOrEqual(layout.demo.y);
	else expect(layout.code.right).toBeLessThanOrEqual(layout.demo.x);
}

export async function countAuthoredPairs(page, html) {
	return page.evaluate(
		(source) =>
			new DOMParser()
				.parseFromString(source, 'text/html')
				.querySelectorAll('.code-demo-pair').length,
		html,
	);
}

export async function expectNativeFocus(control) {
	await control.focus();
	await expect(control).toBeFocused();
	const outlines = await control.evaluate((element) => {
		const read = () => {
			const style = getComputedStyle(element);
			return [
				style.outlineColor,
				style.outlineStyle,
				style.outlineWidth,
				style.outlineOffset,
			];
		};
		const actual = read();
		const original = element.getAttribute('style');
		element.style.outline = 'revert';
		element.style.outlineOffset = 'revert';
		const native = read();
		if (original === null) element.removeAttribute('style');
		else element.setAttribute('style', original);
		return { actual, native };
	});
	expect(outlines.actual).toEqual(outlines.native);
	expect(outlines.actual[1]).not.toBe('none');
	expect(parseFloat(outlines.actual[2])).toBeGreaterThan(0);
	const clippedBy = await control.evaluate((element) => {
		const style = getComputedStyle(element);
		const extent = Math.max(
			0,
			parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset),
		);
		const ring = element.getBoundingClientRect();
		const parent = (node) =>
			node.assignedSlot || node.parentElement || node.getRootNode().host;
		const inTopLayer = (node) =>
			node.matches(':popover-open, :modal') ||
			node === node.ownerDocument.fullscreenElement;
		const clips = [];
		for (
			let ancestor = inTopLayer(element) ? null : parent(element);
			ancestor;
			ancestor = parent(ancestor)
		) {
			const css = getComputedStyle(ancestor);
			const box = ancestor.getBoundingClientRect();
			const left = box.left + ancestor.clientLeft;
			const top = box.top + ancestor.clientTop;
			const clipsX =
				css.overflowX !== 'visible' &&
				(ring.left - extent < left - 0.5 ||
					ring.right + extent > left + ancestor.clientWidth + 0.5);
			const clipsY =
				css.overflowY !== 'visible' &&
				(ring.top - extent < top - 0.5 ||
					ring.bottom + extent > top + ancestor.clientHeight + 0.5);
			if (clipsX || clipsY) {
				clips.push(`${ancestor.localName}.${ancestor.className}`);
			}
			if (inTopLayer(ancestor)) break;
		}
		return clips;
	});
	expect(
		clippedBy,
		'Ancestors must leave room for the native focus ring',
	).toEqual([]);
}

export async function readDemoStyles(name = 'index.html') {
	const page = new URL(`demo/${name}`, root);
	const html = await readFile(page, 'utf8');
	const links = [
		...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g),
	];
	return (
		await Promise.all(
			links.map(([, href]) => readFile(new URL(href, page), 'utf8')),
		)
	).join('\n');
}

export async function serveDemo(
	page,
	{
		grammarFailure = false,
		stalledTheme = false,
		themeFailure = false,
		distinctFields = false,
		translucentFields = false,
		transformHtml,
	} = {},
) {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: async (text) => {
					window.copiedSnippet = text;
				},
			},
		});
	});
	await page.route('**/*', async (route) => {
		const url = new URL(route.request().url());
		let file;
		if (url.href.startsWith(cdn)) {
			if (stalledTheme && url.pathname.endsWith('.css')) return;
			if (themeFailure && url.pathname.endsWith('.css'))
				return route.abort();
			if (grammarFailure && url.pathname.endsWith('/grammars/html.js'))
				return route.abort();
			if (url.pathname.endsWith('/micro-lighter-element.min.js')) {
				await page.locator('micro-lighter').evaluateAll((panels) => {
					panels[0].setAttribute('data-syntax-theme', 'github');
					for (const panel of panels) {
						panel.dataset.authoredSnippet =
							panel.querySelector('code').textContent;
					}
				});
			}
			file = new URL(url.href.slice(cdn.length), distribution);
		} else if (url.origin === 'http://code-demo.test') {
			if (url.pathname.split('/').some((part) => part.startsWith('.')))
				return route.abort();
			file = new URL(`.${url.pathname}`, root);
		} else {
			return route.abort();
		}
		let body;
		try {
			body = await readFile(file);
		} catch (error) {
			if (error.code === 'ENOENT' || error.code === 'EISDIR')
				return route.abort();
			throw error;
		}
		const extension = file.pathname.split('.').at(-1);
		if (extension === 'html' && transformHtml) {
			body = transformHtml(body.toString());
		}
		if (
			(distinctFields || translucentFields) &&
			extension === 'css' &&
			!url.href.startsWith(cdn)
		) {
			body = body
				.toString()
				.replace(
					/\bFieldText\b/g,
					translucentFields ? '#ffffffd8' : 'rgb(255, 255, 0)',
				)
				.replace(
					/\bField\b/g,
					translucentFields ? '#ffffff3f' : 'rgb(20, 30, 40)',
				);
			if (translucentFields)
				body = body
					.replace(/\bCanvasText\b/g, '#ffffff')
					.replace(/\bCanvas\b/g, '#1e1e1e');
		}
		await route.fulfill({
			body,
			contentType:
				{
					html: 'text/html',
					js: 'text/javascript',
					css: 'text/css',
					json: 'application/json',
					svg: 'image/svg+xml',
				}[extension] ?? 'application/octet-stream',
		});
	});
}
