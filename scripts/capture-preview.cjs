const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const targetUrl = process.argv[2] || "http://127.0.0.1:5173/";
const outputPath = path.resolve(
  __dirname,
  "..",
  process.argv[3] || path.join("docs", "assets", "app-preview.png")
);
const width = Number.parseInt(process.argv[4] || "1360", 10);
const height = Number.parseInt(process.argv[5] || "900", 10);

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    backgroundColor: "#eef1f3",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await win.loadURL(targetUrl);
  await wait(900);
  const image = await win.webContents.capturePage();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, image.toPNG());
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
