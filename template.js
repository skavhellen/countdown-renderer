function getBorderRadius(template) {
  switch (template) {
    case "circle":
    case "circle-border":
    case "circle-inside":
      return "50%";
    case "rounded-sm":
      return "4px";
    case "rounded-md":
      return "8px";
    case "rounded-lg":
      return "16px";
    case "square-digits":
      return "0";
    default:
      return "2px";
  }
}

function buildTemplate(config, totalSecs, units, width, height) {
  const template = config.template || "square";
  const font = config.font || "Arial";
  const bgColor = config.background_color || "#FFFFFF";
  const boxColor = config.box_color || "#FE8A22";
  const textColor = config.text_color || "#FFFFFF";
  const labelColor = config.label_color || "#FE8A22";
  const displayDays = config.display_days !== false;
  const displayHours = config.display_hours !== false;

  const isBorder = template.includes("border");
  const isInside = template.includes("inside");
  const isDigits = template === "square-digits";
  const borderRadius = getBorderRadius(template);

  // Use system fonts directly -- Puppeteer's Chromium has these built in
  const fontFamily = `'${font}', sans-serif`;

  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const values = [];
  if (displayDays) values.push(days);
  if (displayHours) values.push(hours);
  values.push(minutes);
  values.push(seconds);

  const digitColor = isDigits || isBorder ? boxColor : textColor;
  const insideLabelColor = isBorder ? boxColor : textColor;
  const boxBg = isDigits ? "transparent" : isBorder ? "transparent" : boxColor;
  const boxBorder = isBorder ? `2px solid ${boxColor}` : "none";

  let unitsHtml = "";
  for (let i = 0; i < units.length; i++) {
    const val = String(values[i]).padStart(2, "0");
    const label = units[i];

    const insideLabelHtml = isInside
      ? `<span style="font-size:9px;text-transform:uppercase;letter-spacing:0.05em;color:${insideLabelColor};font-family:${fontFamily};">${label}</span>`
      : "";

    const outsideLabelHtml = !isInside
      ? `<span style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:500;color:${labelColor};font-family:${fontFamily};">${label}</span>`
      : "";

    unitsHtml += `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
        <div style="
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          width:80px;height:80px;
          background-color:${boxBg};
          border:${boxBorder};
          border-radius:${borderRadius};
        ">
          <span class="unit-value" style="
            font-size:30px;font-weight:700;
            font-variant-numeric:tabular-nums;
            color:${digitColor};
            font-family:${fontFamily};
            line-height:1;
          ">${val}</span>
          ${insideLabelHtml}
        </div>
        ${outsideLabelHtml}
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background-color: ${bgColor};
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body data-display-days="${displayDays}" data-display-hours="${displayHours}">
  <div style="display:inline-flex;align-items:center;gap:12px;padding:24px;border-radius:8px;background-color:${bgColor};">
    ${unitsHtml}
  </div>
</body>
</html>`;
}

module.exports = { buildTemplate };
