#!/usr/bin/env node
/**
 * Render tools/og-template.html to assets/og-image.png at 1200x630.
 *
 * Uses a locally installed Edge/Chrome in headless mode, so the social image
 * stays pixel-identical to the site typography with no npm dependencies.
 *
 *   node tools/generate-og.js
 */
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const TEMPLATE = path.join(__dirname, "og-template.html");
const OUTPUT = path.join(ROOT, "assets", "og-image.png");
const WIDTH = 1200;
const HEIGHT = 630;

function browserCandidates() {
  if (process.platform === "win32") {
    const programFiles = [
      process.env["PROGRAMFILES"],
      process.env["PROGRAMFILES(X86)"],
      process.env["LOCALAPPDATA"],
    ].filter(Boolean);
    const relative = [
      "Microsoft\\Edge\\Application\\msedge.exe",
      "Google\\Chrome\\Application\\chrome.exe",
    ];
    return programFiles.flatMap((dir) => relative.map((rel) => path.join(dir, rel)));
  }
  if (process.platform === "darwin") {
    return [
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ];
  }
  return [
    "/usr/bin/microsoft-edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
}

function findBrowser() {
  const found = browserCandidates().find((candidate) => fs.existsSync(candidate));
  if (!found) {
    console.error(
      "No Edge or Chrome found. Install one, or open tools/og-template.html manually\n" +
        "and capture a 1200x630 screenshot to assets/og-image.png."
    );
    process.exit(1);
  }
  return found;
}

function pngSize(file) {
  const header = fs.readFileSync(file).subarray(0, 24);
  const signature = header.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") return null;
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForFile(file, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (fs.existsSync(file) && fs.statSync(file).size > 0) return true;
    sleep(100);
  }
  return false;
}

if (!fs.existsSync(TEMPLATE)) {
  console.error(`Missing template: ${TEMPLATE}`);
  process.exit(1);
}

const browser = findBrowser();
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
if (fs.existsSync(OUTPUT)) fs.rmSync(OUTPUT);

const result = spawnSync(
  browser,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--user-data-dir=${path.join(os.tmpdir(), "code-to-snippet-og-profile")}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    `--screenshot=${OUTPUT}`,
    pathToFileURL(TEMPLATE).href,
  ],
  { stdio: "ignore", timeout: 60000 }
);

if (result.error) {
  console.error(`Could not start the browser: ${result.error.message}`);
  process.exit(1);
}

if (!waitForFile(OUTPUT)) {
  console.error("The browser did not write the screenshot. Try running it once manually.");
  process.exit(1);
}

const size = pngSize(OUTPUT);
if (!size) {
  console.error("The generated file is not a PNG.");
  process.exit(1);
}
if (size.width !== WIDTH || size.height !== HEIGHT) {
  console.error(`Unexpected size ${size.width}x${size.height}; expected ${WIDTH}x${HEIGHT}.`);
  process.exit(1);
}

const kb = Math.round(fs.statSync(OUTPUT).size / 1024);
console.log(`OG image written: assets/og-image.png (${size.width}x${size.height}, ${kb} KB)`);
