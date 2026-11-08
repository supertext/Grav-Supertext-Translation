#!/usr/bin/env node
/**
 * Records the demo movie (docs/images/demo.gif and an MP4) from a FRESH demo site that uses the
 * stand-in API, like the screenshots. Run it through `composer docs:movie` (scripts/docs-movie.sh
 * builds the site and sets BASE and EDITOR_PASSWORD). The demo editor opens the home page in
 * English, translates it with the Supertext panel into German and French and checks the German
 * version. See "Demo movie" in docs/DEVELOPER.md.
 *
 * Voice: Piper (pip install piper-tts), voice "alba" downloaded once into scripts/movie/voice-cache/
 * (git-ignored); MOVIE_VOICE=0 makes a silent movie. MOVIE_OUT: where the MP4 goes (default
 * scripts/movie/out/Grav-Supertext-Translation.mp4, git-ignored; the MP4 is not committed). Needs ffmpeg.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MovieKit } from './movie-kit.mjs';

const B = (process.env.BASE ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const out = process.env.MOVIE_OUT ?? here('out/Grav-Supertext-Translation.mp4');
const gif = here('../../docs/images/demo.gif');
const need = (name) => process.env[name] ?? (() => { throw new Error(`Set ${name}`); })();
const PANEL = 'grav-supertext-translation--panel';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: 'en-US' });

// Sign in as the demo editor (not recorded).
await page.goto(`${B}/admin`);
await page.locator('#username').fill(process.env.EDITOR_USERNAME ?? 'editor');
await page.locator('#password').fill(need('EDITOR_PASSWORD'));
await page.keyboard.press('Enter');
await page.waitForURL((u) => !u.href.includes('login'));

const supertextButton = page.getByRole('button', { name: 'Supertext translation' });
async function openHome() {
	await page.goto(`${B}/admin/pages/edit/home`);
	await supertextButton.waitFor();
	await page.waitForTimeout(1500);
}
await openHome();

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grav-movie-'));
const kit = await MovieKit.start(page, { workDir, assets: here('assets'), voiceCache: here('voice-cache') });

// 1. The English page in Admin2's page editor.
await kit.say("Here's a page in English, in the page editor of the Grav admin.", { caption: 'A page in English: <b>Welcome to Supertext for Grav</b>' });

// 2. The Supertext panel.
await kit.say('In the toolbar, click the Supertext button.', {
	caption: 'Click the <b>Supertext translation</b> button',
	during: async () => {
		await kit.click(supertextButton);
		await page.locator(`${PANEL} input[data-code]`).first().waitFor();
		await kit.hold(400);
	},
});

// 3. The languages and the translate button.
const translate = page.locator(`${PANEL} button[data-action=translate]`);
await kit.say('German and French are already ticked. Click Translate into 2 languages.', {
	caption: 'Keep <b>Deutsch</b> and <b>Français</b>, click <b>Translate</b>',
	during: async () => {
		await kit.moveTo(page.locator(`${PANEL} input[data-code="de"]`));
		await kit.hold(500);
		await kit.moveTo(page.locator(`${PANEL} input[data-code="fr"]`));
		await kit.hold(500);
		await kit.moveTo(translate);
	},
	after: 0,
});

// 4. Waiting: the progress state for a moment, then the waiting time is cut.
await page.evaluate(([x, y]) => window.__stk?.ripple(x, y), [kit.cursor.x, kit.cursor.y]);
await kit.say('Supertext translates the content.', {
	caption: 'Supertext translates the content…',
	during: async () => {
		await translate.click();
		await page.locator(`${PANEL} .st-spinner`).first().waitFor();
		await kit.hold(1300);
	},
});
kit.pause();
await page.locator(`${PANEL} .st-results`).waitFor({ timeout: 300_000 });
await page.waitForTimeout(500);
kit.resume();
await kit.sync();

// 5. The result.
await kit.say('A few seconds later, the German and French versions are there, saved unpublished.', {
	caption: 'Done: German and French versions, saved unpublished',
	during: () => kit.moveTo(page.locator(`${PANEL} .st-results`)),
});
await kit.say("Let's close the panel, and check the German version.", {
	caption: 'Close the panel to check the German version',
	during: () => kit.click(page.locator(`${PANEL} button[data-action=close]`)),
});
// The editor's list of translations is refreshed with a reload (loading time cut).
await kit.caption('');
kit.pause();
await openHome();
kit.resume();
await kit.sync();
await kit.say('Switch the editor to German.', {
	caption: 'Switch the editor to <b>Deutsch</b>',
	during: async () => {
		await kit.click(page.locator('button:has-text("Deutsch")').filter({ hasNotText: 'Create' }).first());
		await page.getByText('Willkommen bei Supertext', { exact: false }).first().waitFor();
		await kit.hold(500);
		await kit.sync();
	},
});
await kit.say('The German version is ready. Review it, and publish it as usual.', { caption: 'The German version is ready – review it and publish' });
await kit.caption('');

fs.mkdirSync(path.dirname(out), { recursive: true });
await kit.finish(out, { system: 'Grav', repo: 'Grav-Supertext-Translation', gif });
await browser.close();
fs.rmSync(workDir, { recursive: true, force: true });
console.log(`Saved ${out} and ${gif} (${(fs.statSync(gif).size / 1e6).toFixed(2)} MB)`);
