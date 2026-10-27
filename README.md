## `🤖 Build with AI Assistance` 

# code-to-snippet

Live site: **https://f-wafa.github.io/code-to-snippet/**

Convert plain code into a VS Code snippet, right in the browser.

Paste your code, set a name, prefix, description, and language scope, then copy the generated
JSON or download a ready-to-use `.code-snippets` file. No build step, no dependencies, no uploads.

## Features

- Live conversion to the VS Code snippet JSON format
- Escapes literal `$` and `\` characters so code such as jQuery, PHP, regex, and template
  literals keeps working
- Optional support for VS Code placeholders: `$1`, `${1:name}`, `${1|a,b|}`, `$TM_FILENAME`, ...
- Language scope selector and a sensible output file name
- Syntax-highlighted output, line numbers, copy, and download
- Keyboard friendly: `Tab` inserts spaces, `Ctrl/⌘ + Enter` copies
- Responsive, dependency-free, and fully client-side

### Installing a generated snippet in VS Code

1. Copy the JSON or download the `.code-snippets` file.
2. In VS Code, open the Command Palette and run **Preferences: Configure User Snippets**.
3. Paste the JSON into an existing snippet file, or add the downloaded file to your snippets
   folder.
4. Type the prefix in an editor and press `Tab` to expand it.

## How escaping works

VS Code treats `$` as snippet syntax. By default, the converter keeps real tab stops and
variables (`$1`, `${1:name}`, `$TM_FILENAME`) and escapes everything else:

| Plain code | Snippet body |
| --- | --- |
| `$('.item')` | `\$('.item')` |
| `${name}` | `\${name}` |
| `$1` | `$1` (tab stop) |

Turn off **Keep VS Code placeholders** to escape every dollar sign.

## Project structure

```text
index.html         Markup and content
assets/styles.css  Simple light theme
assets/app.js      Conversion logic and UI behavior
assets/logo.svg    Logo mark (header, favicon, social image)
assets/og-image.png  1200×630 social preview image
tools/og-template.html  Source layout for the social image
tools/generate-og.js    Renders the social image with headless Edge/Chrome
server.js          Tiny static dev server (no dependencies)
favicon.svg        Site icon (same artwork as assets/logo.svg)
```

## Regenerating the social image

`assets/og-image.png` is generated from `tools/og-template.html` at 1200×630 using a
locally installed Edge or Chrome, so no npm dependencies are required:

```bash
node tools/generate-og.js
```

The script finds the browser automatically and verifies the output size. Edit the HTML
template (headline, logo, colors, code sample) and run it again after a rebrand.

## License

MIT
