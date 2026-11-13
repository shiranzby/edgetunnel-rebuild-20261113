import { readFile, writeFile } from 'node:fs/promises';

// Keep the upstream page verbatim; all project adaptations live in panel-view.js.
const html = await readFile(new URL('../upstream/panel.html', import.meta.url), 'utf8');
await writeFile(new URL('../upstream/panel-template.js', import.meta.url),
  '// Source: https://edt-pages.github.io/admin (cmliu/edgetunnel), GPL-3.0.\nexport default ' + JSON.stringify(html) + ';\n');
