#!/usr/bin/env node
/**
 * Records the install and configuration movie (MP4 only, no GIF) from a FRESH demo site without an
 * API key, against the stand-in API. Run it through `composer docs:movie:install` (scripts/docs-movie.sh
 * builds the site and sets BASE and ADMIN_PASSWORD). An administrator installs the plugin (terminal:
 * release zip into user/plugins, bin/grav clear), shows the site languages, enters a made-up API key in
 * Plugins → Supertext Translation (the stand-in accepts any key), saves and sees the key check, checks
 * the language mapping and shows where editors find the Supertext button. See "Demo movie" in docs/DEVELOPER.md.
 *
 * MOVIE_VOICE=0 makes a silent movie. MOVIE_OUT: where the MP4 goes (default
 * scripts/movie/out/Grav-Supertext-Translation-install.mp4, git-ignored). Needs ffmpeg.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MovieKit } from './movie-kit.mjs';

const B = (process.env.BASE ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const out = process.env.MOVIE_OUT ?? here('out/Grav-Supertext-Translation-install.mp4');
const need = (name) => process.env[name] ?? (() => { throw new Error(`Set ${name}`); })();
const FAKE_KEY = 'st-demo-0000-0000-0000';
const VERSION = '0.1.0';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: 'en-US' });

// Sign in as the demo administrator (not recorded): configuration is an administrator's task.
await page.goto(`${B}/admin`);
await page.locator('#username').fill(process.env.ADMIN_USERNAME ?? 'admin');
await page.locator('#password').fill(need('ADMIN_PASSWORD'));
await page.keyboard.press('Enter');
await page.waitForURL((u) => !u.href.includes('login'));
await page.waitForTimeout(1000);

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grav-movie-install-'));
await page.goto('about:blank');
const kit = await MovieKit.start(page, { workDir, assets: here('assets'), voiceCache: here('voice-cache') });
const ripple = () => page.evaluate(([x, y]) => window.__stk?.ripple(x, y), [kit.cursor.x, kit.cursor.y]);
const nav = (name) => page.locator('aside a, nav a').filter({ hasText: new RegExp(`^\\s*${name}\\b`) }).first();

/** More commands in the terminal kit.terminal() opened (same look; kit.terminal() would start a new one). */
async function typeMore(lines) {
	await page.evaluate(() => document.querySelector('#x > .p.c:last-child')?.remove());
	for (const l of lines) {
		if (l.cmd !== undefined) {
			await page.evaluate(() => { const x = document.getElementById('x');
				const p = document.createElement('span'); p.className = 'p'; p.textContent = '$ '; x.appendChild(p);
				const c = document.createElement('span'); c.className = 'c'; x.appendChild(c); });
			for (const ch of l.cmd) { await page.evaluate((ch) => { document.querySelector('#x .c').textContent += ch; }, ch); await page.waitForTimeout(38); }
			await page.waitForTimeout(450);
			await page.evaluate(() => { document.querySelector('#x .c').classList.remove('c'); document.getElementById('x').append('\n'); });
		} else {
			await page.evaluate((o) => { const s = document.createElement('span'); s.className = 'o'; s.textContent = o + '\n'; document.getElementById('x').appendChild(s); }, l.out ?? '');
			await page.waitForTimeout(l.wait ?? 180);
		}
	}
	await page.evaluate(() => { const c = document.createElement('span'); c.className = 'p c'; c.textContent = '$ '; document.getElementById('x').appendChild(c); });
}

// 1. Terminal: the steps from docs/INSTALLATION.md (release zip into user/plugins, then clear the cache).
await kit.say("First, open a terminal in your Grav site's folder, and download the latest release of the plugin from GitHub.", {
	caption: 'Download the latest release from <b>GitHub</b>',
	during: () => kit.terminal({ title: 'my-site', lines: [
		{ cmd: `curl -fsSLO https://github.com/Supertext/Grav-Supertext-Translation/releases/download/v${VERSION}/supertext-translation-${VERSION}.zip` },
	] }),
});
await kit.say('Unzip it into the folder user, plugins. It brings its own folder, supertext translation.', {
	caption: 'Unzip it into <b>user/plugins</b>',
	during: () => typeMore([
		{ cmd: `unzip -q supertext-translation-${VERSION}.zip -d user/plugins` },
		{ cmd: 'ls user/plugins' },
		{ out: 'admin2  api  email  error  flex-objects  form  github-markdown-alerts' },
		{ out: 'login  problems  shortcode-core  supertext-translation' },
	]),
});
await kit.say("Then clear Grav's cache.", {
	caption: 'Clear the cache: <b>bin/grav clear</b>',
	during: () => typeMore([
		{ cmd: 'bin/grav clear' },
		{ out: 'Clearing cache' },
		{ out: 'Cleared:  cache/grav/*' },
		{ out: 'Cleared:  cache/compiled/*' },
		{ out: 'Touched: user/config/system.yaml' },
	]),
});
await kit.hold(300);

// 2. The site languages (Grav's own setup, already done in the demo).
kit.pause();
await page.goto(`${B}/admin/config/system`);
await page.getByRole('button', { name: 'Languages', exact: true }).click();
await page.waitForTimeout(1500);
await kit.sync();
kit.resume();
await kit.say("Now sign in to the Grav admin. Your site's languages are set up under Configuration, System, Languages. Here: English, German and French.", {
	caption: 'Site languages: <b>Configuration → System → Languages</b>',
	during: async () => { await kit.hold(1500); await kit.moveTo(page.getByText('Supported', { exact: false }).first()); },
});

// 3. Plugins → Supertext Translation.
await kit.say('Open Plugins in the menu, and search for Supertext Translation.', {
	caption: 'Open <b>Plugins</b>, search for <b>Supertext</b>',
	during: async () => {
		await kit.click(nav('Plugins'));
		// The plugin list loads (cut).
		kit.pause();
		const search = page.locator('input[placeholder^="Search plugins"]');
		await search.waitFor();
		await page.getByRole('button', { name: 'Configure' }).first().waitFor();
		await page.waitForTimeout(300);
		kit.resume();
		await kit.sync();
		await kit.click(search);
		await search.pressSequentially('supertext', { delay: 70 });
	},
});
await kit.say('Select Supertext Translation, and click Configure.', {
	caption: '<b>Supertext Translation → Configure</b>',
	during: async () => {
		await kit.click(page.getByText('Supertext Translation', { exact: true }).first());
		await kit.hold(500);
		await kit.click(page.getByRole('button', { name: 'Configure' }));
		await page.getByText('Supertext account', { exact: true }).waitFor();
		await page.locator('[data-testid=supertext-key-check]').waitFor();
		await kit.sync();
	},
});

// 4. The API key.
const key = page.locator('#api_key');
await kit.say('Generate your API key at supertext.com, under Integrations, A P I. This needs the Admin role. No account yet? Create one at supertext.com.', {
	caption: 'API key: <b>supertext.com → Integrations → API</b><br>No account yet? Create one at <b>supertext.com</b>',
	during: async () => { await kit.hold(600); await kit.moveTo(page.getByText('No Supertext account yet?', { exact: false }).first()); },
});
await kit.say('Paste the key into the field API key.', {
	caption: 'Paste it into <b>API key</b>',
	during: async () => {
		await kit.type(key, FAKE_KEY);
	},
});

// 5. Save → the API key check.
const save = page.getByRole('button', { name: 'Save', exact: true });
const keyCheck = page.locator('[data-testid=supertext-key-check]');
await kit.say('Click Save at the top. The plugin then checks the key with Supertext, right away.', {
	caption: 'Click <b>Save</b>',
	during: async () => {
		await kit.click(save);
		// Saving and the key check take a moment: cut.
		kit.pause();
		await page.locator('[data-testid=supertext-key-check][data-status=ok]').waitFor({ timeout: 60_000 });
		await page.waitForTimeout(500);
		kit.resume();
		await kit.sync();
	},
});
await kit.say('The key check says: the connection to Supertext works.', {
	caption: 'API key check: <b>the connection to Supertext works</b>',
	during: () => kit.moveTo(keyCheck),
});

// 6. The language mapping.
const mapping = page.locator('grav-supertext-translation--supertext-languages');
const german = mapping.locator('select[data-code="de"]');
await kit.say('Under Languages, every site language has its Supertext language.', {
	caption: '<b>Languages → Supertext language codes</b>',
	during: async () => {
		await page.getByText('Languages', { exact: true }).last().evaluate((el) => {
			let p = el.parentElement; while (p && !(p.scrollHeight > p.clientHeight + 10 && getComputedStyle(p).overflowY !== 'visible')) p = p.parentElement;
			(p ?? document.scrollingElement).scrollBy({ top: el.getBoundingClientRect().top - 190, behavior: 'smooth' });
		});
		await kit.hold(1000);
		await kit.sync();
		await kit.moveTo(german);
	},
});
await kit.say('Open the list to pick a variant. For German, we keep Swiss High German, d e C H.', {
	caption: 'Deutsch → <b>Swiss High German (de-CH)</b>',
	during: async () => {
		await kit.click(german);
		// A native drop-down isn't recorded: show the options as a list for a moment.
		const spot = await german.evaluate(async (s) => {
			s.size = 7; s.style.position = 'relative'; s.style.zIndex = 50; s.style.height = 'auto';
			const option = [...s.options].find((o) => o.value === 'de-CH');
			s.scrollTop = Math.max(0, (option.index - 3) * (s.scrollHeight / s.options.length));
			await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
			const o = option.getBoundingClientRect();
			return { x: s.getBoundingClientRect().left + 110, y: o.top + o.height / 2 };
		});
		await kit.hold(900);
		kit.cursor = spot; await kit.sync(); await kit.hold(800); await ripple();
		await german.selectOption('de-CH');
		await kit.hold(400);
		await german.evaluate((s) => { s.size = 0; s.removeAttribute('size'); s.style.position = ''; s.style.zIndex = ''; s.style.height = ''; });
		await kit.moveTo(german);
	},
});
await kit.say('Translation review can be switched on per language. We leave it off. If you change anything here, click Save again.', {
	caption: '<b>Translation review</b>: optional, per language (left off)',
	during: async () => { await kit.hold(300); await kit.moveTo(mapping.locator('input[data-review="de"]')); },
});

// 7. Where editors find the Supertext button.
const supertextButton = page.getByRole('button', { name: 'Supertext translation' });
// The page editor (loading time cut).
await kit.caption('');
kit.pause();
await page.goto(`${B}/admin/pages/edit/home`);
await supertextButton.waitFor();
await page.waitForTimeout(1200);
kit.resume();
await kit.sync();
await kit.say("That's it. Editors now find the Supertext button in the toolbar of the page editor.", {
	caption: 'Editors find the <b>Supertext translation</b> button here',
	during: async () => {
		await kit.moveTo(supertextButton);
		await supertextButton.hover();
		await kit.hold(800);
	},
});
await kit.caption('');

fs.mkdirSync(path.dirname(out), { recursive: true });
await kit.finish(out, { system: 'Grav', repo: 'Grav-Supertext-Translation', kind: 'install' });
await browser.close();
fs.rmSync(workDir, { recursive: true, force: true });
console.log(`Saved ${out}`);
