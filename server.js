const express = require("express");
const puppeteer = require("puppeteer");
const GIFEncoder = require("gif-encoder-2");
const { PNG } = require("pngjs");
const { buildTemplate } = require("./template");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "change-me";

let browser = null;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browser;
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/generate-gif", async (req, res) => {
  // Validate API key
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (token !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { config, diffMs } = req.body;
    if (!config || diffMs === undefined) {
      return res.status(400).json({ error: "Missing config or diffMs" });
    }

    const numFrames = 30;
    const b = await getBrowser();
    const page = await b.newPage();

    // Build units list
   const units = [];
    if (config.display_days) units.push(config.label_days || "Days");
    if (config.display_hours) units.push(config.label_hours || "Hours");
    units.push(config.label_minutes || "Minutes");
    units.push(config.label_seconds || "Seconds");

    // Calculate dimensions based on number of units
    const boxSize = 80;
    const gap = 12;
    const padding = 48;
    const insideVariant = (config.template || "").includes("inside");
    const contentWidth = units.length * boxSize + (units.length - 1) * gap;
    const width = contentWidth + padding;
    const height = insideVariant ? boxSize + padding : boxSize + 30 + padding;

    await page.setViewport({ width, height, deviceScaleFactor: 2 });

    // Generate first frame HTML
    const totalSecsStart = Math.floor(Math.max(0, diffMs) / 1000);
    const html = buildTemplate(config, totalSecsStart, units, width, height);
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Capture frames
    const frames = [];
    for (let f = 0; f < numFrames; f++) {
      const remaining = Math.max(0, diffMs - f * 1000);
      const totalSecs = Math.floor(remaining / 1000);
      const days = Math.floor(totalSecs / 86400);
      const hours = Math.floor((totalSecs % 86400) / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;

      // Update the displayed values via JS in the page
      await page.evaluate(
        (d, h, m, s) => {
          const els = document.querySelectorAll(".unit-value");
          const values = [];
          if (document.body.dataset.displayDays === "true") values.push(d);
          if (document.body.dataset.displayHours === "true") values.push(h);
          values.push(m);
          values.push(s);
          els.forEach((el, i) => {
            if (values[i] !== undefined) {
              el.textContent = String(values[i]).padStart(2, "0");
            }
          });
        },
        days,
        hours,
        minutes,
        seconds
      );

      const screenshot = await page.screenshot({ type: "png", omitBackground: false });
      frames.push(screenshot);
    }

    await page.close();

    // Encode GIF
    const firstPng = PNG.sync.read(frames[0]);
    const gifWidth = firstPng.width;
    const gifHeight = firstPng.height;

    const encoder = new GIFEncoder(gifWidth, gifHeight);
    encoder.setDelay(1000);
    encoder.setRepeat(0); // infinite loop
    encoder.setQuality(1);
    encoder.start();

    for (const frameBuf of frames) {
      const png = PNG.sync.read(frameBuf);
      // GIFEncoder expects raw RGBA pixel data
      encoder.addFrame(png.data);
    }

    encoder.finish();
    const gifBuffer = encoder.out.getData();

    res.set({
      "Content-Type": "image/gif",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    res.send(gifBuffer);
  } catch (err) {
    console.error("GIF generation error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Countdown renderer running on port ${PORT}`);
  // Pre-launch browser
  getBrowser().then(() => console.log("Browser ready"));
});
