(() => {
  const carousel = document.querySelector('.carousel');
  const stage = carousel.querySelector('.carousel__stage');
  const cards = Array.from(carousel.querySelectorAll('.carousel__card'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const step = (2 * Math.PI) / cards.length;
  const revolutionDuration = 30000;

  let angle = 0;
  let hoveredCard = null;
  let focusedCard = null;
  let frame = null;
  let lastTime = null;
  let radius = 0;

  function resize() {
    const width = cards[0].offsetWidth;
    const height = Math.max(...cards.map((card) => card.offsetHeight));
    radius = Math.max(0, (stage.clientWidth - width) / 2);
    stage.style.height = `${height + 180}px`;
    render();
  }

  function render() {
    const activeCard = focusedCard || hoveredCard;
    cards.forEach((card, index) => {
      const position = angle + index * step;
      const depth = (Math.cos(position) + 1) / 2;
      const x = Math.sin(position) * radius;
      const active = card === activeCard;
      const scale = active ? 1 : 0.65 + depth * 0.35;
      const rotation = active ? 0 : Math.sin(position) * Math.cos(position) * 50;
      const y = (depth - 1) * 110;
      const brightness = active ? 1 : 0.72 + depth * 0.28;

      card.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale}) rotateY(${rotation}deg)`;
      card.style.filter = `brightness(${brightness}) invert(${active ? 1 : 0})`;
      card.style.zIndex = active ? '1001' : String(Math.round(depth * 1000));
    });
  }

  function schedule() {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    lastTime = null;
    if (!hoveredCard && !focusedCard && !reducedMotion.matches) {
      frame = requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    frame = null;
    const elapsed = lastTime === null ? 0 : Math.min(now - lastTime, 50);
    lastTime = now;

    angle -= (2 * Math.PI * elapsed) / revolutionDuration;
    angle %= 2 * Math.PI;
    render();
    frame = requestAnimationFrame(tick);
  }

  cards.forEach((card) => {
    card.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'touch') {
        hoveredCard = card;
        render();
        schedule();
      }
    });
    card.addEventListener('pointerleave', (event) => {
      if (event.pointerType !== 'touch') {
        if (hoveredCard === card) hoveredCard = null;
        render();
        schedule();
      }
    });
    card.addEventListener('focus', () => {
      focusedCard = card;
      render();
      schedule();
    });
    card.addEventListener('blur', () => {
      focusedCard = null;
      render();
      schedule();
    });
  });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    lastTime = null;
  });
  reducedMotion.addEventListener('change', schedule);

  focusedCard = cards.find((card) => card === document.activeElement) || null;
  resize();
  schedule();
})();
