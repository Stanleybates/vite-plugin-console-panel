# vite-plugin-console-panel

A Vite plugin that adds a floating mobile-friendly devtools panel to your app during development — Console, Network, and Elements tabs, built specifically for debugging on a phone where real browser devtools aren't available.

## Why

Testing a site on your phone is common, but mobile browsers don't give you console access, network inspection, or a DOM inspector the way desktop browsers do. This plugin fills that gap by injecting a lightweight debug panel directly into your dev server — no separate app, no USB cable, no remote debugging setup.

## Install

npm install --save-dev vite-plugin-console-panel

## Usage

Add it to your vite.config.ts:

import { defineConfig } from 'vite';
import consolePanel from 'vite-plugin-console-panel';

export default defineConfig({
  plugins: [consolePanel()],
});

That's it — no other configuration needed. Run your dev server as usual (npm run dev) and open your site on your phone.

## What it does

- Console tab — captures console.log, console.warn, console.error, uncaught exceptions, and unhandled promise rejections.
- Network tab — shows every fetch and XMLHttpRequest call: method, URL, status, and timing.
- Elements tab — tap any element on the page to inspect its tag, classes, box size/position, attributes, and computed styles.

The panel stays hidden by default and only reveals itself automatically when an error occurs (console.error, an uncaught exception, etc.) — so it won't clutter your screen during normal use.

## Dev-only, by design

This plugin uses Vite's apply: 'serve' option, meaning it is only active while running vite dev (or your framework's dev command). It is completely absent from production builds — no env checks, no manual removal needed, nothing ships to your real users.

## Works with SSR frameworks too

The plugin intercepts HTML responses at the server level, so it works with both static Vite apps and full server-rendered frameworks (TanStack Start, and similar Vite-based SSR setups).

## License

MIT
