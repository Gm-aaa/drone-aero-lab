export function setupHiDPICanvas(canvas, logicalWidth, logicalHeight) {
  const dpr = Math.min(globalThis.devicePixelRatio ?? 1, 2);
  canvas.width = Math.round(logicalWidth * dpr);
  canvas.height = Math.round(logicalHeight * dpr);
  if (canvas.style) {
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;
  }
  const context = canvas.getContext('2d');

  function beginFrame() {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  return {
    context,
    width: logicalWidth,
    height: logicalHeight,
    dpr,
    beginFrame,
  };
}
