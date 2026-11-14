import { readFile, writeFile } from 'node:fs/promises';

// Keep the upstream page verbatim; externalize the nested CFST document script.
const html = await readFile(new URL('../upstream/panel.html', import.meta.url), 'utf8');
await writeFile(new URL('../upstream/panel-template.js', import.meta.url),
  '// Source: https://edt-pages.github.io/admin (cmliu/edgetunnel), GPL-3.0.\nexport default ' + JSON.stringify(html) + ';\n');
const marker = html.indexOf('function syncEmbeddedTheme()');
const start = html.lastIndexOf('<script>', marker);
const end = html.indexOf('</script>', marker);
if (marker < 0 || start < 0 || end < 0) throw new Error('Nested CFST script not found');
const source = html.slice(start + '<script>'.length, end);
const external = html.slice(0, start) +
  '<script data-cfasync="false" src="/__shy_panel_cfst.js"></script>' +
  html.slice(end + '</script>'.length);
await writeFile(new URL('../upstream/panel-template-no-script1.js', import.meta.url),
  '// Nested CFST script loads only when its template is opened as an iframe.\nexport default ' + JSON.stringify(external) + ';\n');
await writeFile(new URL('../upstream/panel-script1-lazy-module.js', import.meta.url),
  'export default ' + JSON.stringify(source) + ';\n');
