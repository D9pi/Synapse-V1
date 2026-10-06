// electron-builder hook: copy the standalone Next.js server (including its node_modules,
// which extraResources would strip) into the packaged app's resources folder.
// Runs before code signing, so signatures cover these files.
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName, packager } = context;
  const resources =
    electronPlatformName === "darwin"
      ? path.join(appOutDir, `${packager.appInfo.productFilename}.app`, "Contents", "Resources")
      : path.join(appOutDir, "resources");
  const src = path.join(packager.projectDir, ".next", "standalone");
  if (!fs.existsSync(path.join(src, "server.js"))) {
    throw new Error('Standalone server missing. Run "npm run desktop:prepare" first.');
  }
  const dest = path.join(resources, "server");
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true, verbatimSymlinks: true });
  console.log(`  • copied server bundle  to=${path.relative(packager.projectDir, dest)}`);
};
