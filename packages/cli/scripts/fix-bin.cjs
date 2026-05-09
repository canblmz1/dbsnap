const fs = require("node:fs");
const path = require("node:path");

const binPath = path.join(__dirname, "..", "dist", "index.js");
if (fs.existsSync(binPath)) {
  const content = fs.readFileSync(binPath, "utf8");
  const fixed = content.startsWith("#!/usr/bin/env node")
    ? content
    : `#!/usr/bin/env node\n${content}`;
  fs.writeFileSync(binPath, fixed, { mode: 0o755 });
}
