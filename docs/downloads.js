const owner = "nickpiccaro";
const repo = "cv-generator";
const latestReleaseUrl = `https://github.com/${owner}/${repo}/releases/latest`;
const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

const targets = [
  { id: "download-mac-arm64", os: "mac", arch: "arm64", ext: ".dmg" },
  { id: "download-mac-x64", os: "mac", arch: "x64", ext: ".dmg" },
  { id: "download-win-x64", os: "win", arch: "x64", ext: ".exe" },
  { id: "download-win-arm64", os: "win", arch: "arm64", ext: ".exe" }
];

function setStatus(message) {
  const status = document.getElementById("release-status");
  if (status) status.textContent = message;
}

function findAsset(assets, target) {
  return assets.find((asset) => {
    const name = asset.name.toLowerCase();
    return name.includes(`-${target.os}-`) && name.includes(`-${target.arch}.`) && name.endsWith(target.ext);
  });
}

async function hydrateDownloads() {
  try {
    const response = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const release = await response.json();
    const assets = Array.isArray(release.assets) ? release.assets : [];

    for (const target of targets) {
      const link = document.getElementById(target.id);
      const asset = findAsset(assets, target);
      if (link && asset?.browser_download_url) {
        link.href = asset.browser_download_url;
        link.setAttribute("download", "");
      }
    }

    setStatus(`Latest release: ${release.tag_name || "available on GitHub"}`);
  } catch {
    for (const target of targets) {
      const link = document.getElementById(target.id);
      if (link) link.href = latestReleaseUrl;
    }
    setStatus("Downloads open the latest GitHub release until release assets are published.");
  }
}

hydrateDownloads();
