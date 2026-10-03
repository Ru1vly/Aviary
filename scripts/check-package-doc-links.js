const fs = require('node:fs');
const path = require('node:path');

/** Audit simple relative Markdown file links against the actual npm file manifest. */
function checkPackageDocumentation(stage, files) {
  const shipped = new Set(files.map((file) => file.path));
  const missing = [];
  let checkedRelativeFileLinks = 0;
  for (const filename of shipped) {
    if (!filename.endsWith('.md')) continue;
    const text = fs
      .readFileSync(path.join(stage, filename), 'utf8')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`\n]*`/g, '');
    for (const match of text.matchAll(/\[[^\]]*\]\(([^\s)]+)/g)) {
      const target = match[1].replace(/^<|>$/g, '');
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#') || target.startsWith('/'))
        continue;
      const local = target.split(/[?#]/)[0];
      if (!local) continue;
      checkedRelativeFileLinks += 1;
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(filename), decodeURIComponent(local))
      );
      if (!shipped.has(resolved)) missing.push({ file: filename, target, resolved });
    }
  }
  return {
    checkedRelativeFileLinks,
    missing,
    scope:
      'Simple relative Markdown file links outside code examples; anchors and external URLs not assessed.',
  };
}
module.exports = { checkPackageDocumentation };
