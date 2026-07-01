const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function runGit(args, fallback) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return fallback;
  }
}

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const buildInfo = {
  version: packageJson.version,
  gitCommit: runGit(["rev-parse", "--short=12", "HEAD"], "development"),
  builtAt: new Date().toISOString()
};

fs.writeFileSync(
  path.join(root, "electron", "build-info.json"),
  `${JSON.stringify(buildInfo, null, 2)}\n`,
  "utf8"
);
