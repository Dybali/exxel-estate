// Some restricted Windows runners reject realpathSync.native for ordinary
// workspace files while realpathSync succeeds. Vite uses the native form.
const fs = require("node:fs");
if (process.platform === "win32") {
  try {
    fs.realpathSync.native(__filename);
  } catch (error) {
    if (error && error.code === "EPERM") fs.realpathSync.native = fs.realpathSync;
  }
}
