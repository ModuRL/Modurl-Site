(() => {
  const engine = document.querySelector("#gear-engine");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const artwork = document.querySelector("#mascot-Gear_Alltogether");
  const floatingGroup = document.querySelector("#mascot-float");
  const svgNamespace = "http://www.w3.org/2000/svg";
  const definitions = artwork.querySelector("defs");

  function createEye(eyeGroup, eyeIndex) {
    const eyeBounds = eyeGroup.getBBox();
    const [oval, highlight] = eyeGroup.querySelectorAll("path");
    const ovalBounds = oval.getBBox();
    const highlightBounds = highlight.getBBox();
    const clipPath = document.createElementNS(svgNamespace, "clipPath");
    clipPath.id = `mascot-eye-clip-${eyeIndex}`;
    clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");
    clipPath.append(oval.cloneNode(true));
    definitions.append(clipPath);

    const clippedHighlight = document.createElementNS(svgNamespace, "g");
    clippedHighlight.setAttribute("clip-path", `url(#${clipPath.id})`);
    const catchlight = document.createElementNS(svgNamespace, "g");
    catchlight.classList.add("mascot-catchlight");
    catchlight.append(highlight);
    clippedHighlight.append(catchlight);
    eyeGroup.append(clippedHighlight);

    return {
      group: eyeGroup,
      catchlight,
      centerX: eyeBounds.x + eyeBounds.width / 2,
      centerY: eyeBounds.y + eyeBounds.height / 2,
      minX: Math.min(0, ovalBounds.x - highlightBounds.x + 0.2),
      maxX: Math.max(
        0,
        ovalBounds.x +
          ovalBounds.width -
          highlightBounds.x -
          highlightBounds.width -
          0.2,
      ),
      minY: Math.min(0, ovalBounds.y - highlightBounds.y + 0.2),
      maxY: Math.max(
        0,
        ovalBounds.y +
          ovalBounds.height -
          highlightBounds.y -
          highlightBounds.height -
          0.2,
      ),
      offsetX: 0,
      offsetY: 0,
    };
  }

  const eyes = [...artwork.querySelectorAll(".mascot-eye")].map(createEye);

  function createGear(gearGroup) {
    const eyePair = eyes.filter((eye) => eye.group.parentElement === gearGroup);
    const faceAngle =
      (Math.atan2(
        eyePair[1].centerY - eyePair[0].centerY,
        eyePair[1].centerX - eyePair[0].centerX,
      ) *
        180) /
      Math.PI;
    return {
      eyes: eyePair,
      faceAngle,
      nextBlink: performance.now() + 2500 + Math.random() * 4500,
      blinkStart: -Infinity,
    };
  }

  const gears = [...new Set(eyes.map((eye) => eye.group.parentElement))].map(
    createGear,
  );
  let pointerPosition = null;
  let previousFrameTime = performance.now();

  function trackPointer(event) {
    const screenPoint = engine.createSVGPoint();
    screenPoint.x = event.clientX;
    screenPoint.y = event.clientY;
    pointerPosition = screenPoint.matrixTransform(
      artwork.getScreenCTM().inverse(),
    );
  }

  window.addEventListener("pointermove", trackPointer, { passive: true });
  window.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) pointerPosition = null;
  });
  window.addEventListener("blur", () => {
    pointerPosition = null;
  });

  function animateBlink(gear, frameTime) {
    if (frameTime > gear.nextBlink) {
      gear.blinkStart = frameTime;
      gear.nextBlink = frameTime + 3000 + Math.random() * 5000;
    }
    const blinkProgress = Math.min(1, (frameTime - gear.blinkStart) / 240);
    const eyeScale = reducedMotion.matches
      ? 1
      : 1 - 0.94 * Math.sin(Math.PI * blinkProgress);
    gear.eyes.forEach((eye) => {
      // Rotate into the face's axes so closure is perpendicular to the eye pair.
      eye.group.setAttribute(
        "transform",
        `translate(${eye.centerX} ${eye.centerY}) rotate(${gear.faceAngle}) scale(1 ${eyeScale}) rotate(${-gear.faceAngle}) translate(${-eye.centerX} ${-eye.centerY})`,
      );
    });
  }

  function animateCatchlight(eye, smoothing) {
    const deltaX = pointerPosition ? pointerPosition.x - eye.centerX : 0;
    const deltaY = pointerPosition ? pointerPosition.y - eye.centerY : 0;
    const distance = Math.hypot(deltaX, deltaY) || 1;
    const strength = Math.min(distance / 35, 1);
    const targetX =
      reducedMotion.matches || !pointerPosition
        ? 0
        : (deltaX / distance) * strength * (deltaX < 0 ? -eye.minX : eye.maxX);
    const targetY =
      reducedMotion.matches || !pointerPosition
        ? 0
        : (deltaY / distance) * strength * (deltaY < 0 ? -eye.minY : eye.maxY);
    eye.offsetX = reducedMotion.matches
      ? 0
      : eye.offsetX + (targetX - eye.offsetX) * smoothing;
    eye.offsetY = reducedMotion.matches
      ? 0
      : eye.offsetY + (targetY - eye.offsetY) * smoothing;
    eye.catchlight.setAttribute(
      "transform",
      `translate(${eye.offsetX} ${eye.offsetY})`,
    );
  }

  function renderFrame(frameTime) {
    const smoothing =
      1 -
      Math.exp(-Math.min((frameTime - previousFrameTime) / 1000, 0.05) * 12);
    previousFrameTime = frameTime;
    floatingGroup.setAttribute(
      "transform",
      `translate(0 ${reducedMotion.matches ? 0 : Math.sin(frameTime * 0.0007) * 3})`,
    );
    gears.forEach((gear) => animateBlink(gear, frameTime));
    eyes.forEach((eye) => animateCatchlight(eye, smoothing));
    requestAnimationFrame(renderFrame);
  }

  requestAnimationFrame(renderFrame);
})();
