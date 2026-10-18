// Cartes interactives (régions de France, départements d'une région) :
// Ansuz attend au point de départ, marche jusqu'à la zone cliquée, puis ouvre sa page.
(function () {
  const poses = ["/img/ansuz-marche-1.webp", "/img/ansuz-marche-2.webp"];
  document.querySelectorAll(".carte-ansuz").forEach(zone => {
    const svg = zone.querySelector("svg");
    const vb = svg.viewBox.baseVal;
    const ansuz = zone.querySelector(".ansuz-carte");
    const bulle = zone.querySelector(".annonce-carte");
    let pos = [parseFloat(zone.dataset.x), parseFloat(zone.dataset.y)];  // en coordonnées de la carte
    let enRoute = false;

    // coordonnées de la carte -> pixels dans la zone
    function versPixels(p) {
      const r = svg.getBoundingClientRect(), z = zone.getBoundingClientRect();
      const s = Math.min(r.width / vb.width, r.height / vb.height);
      const ox = r.left - z.left + (r.width - vb.width * s) / 2, oy = r.top - z.top + (r.height - vb.height * s) / 2;
      return [ox + (p[0] - vb.x) * s, oy + (p[1] - vb.y) * s];
    }
    function placer(p, t, marche, gauche) {
      const [x, y] = versPixels(p);
      const bob = marche ? Math.abs(Math.sin(t / 110)) * 6 : 0;
      const w = ansuz.offsetWidth, maxX = zone.clientWidth - w;
      const gx = Math.max(0, Math.min(maxX, x - w / 2));  // reste dans le cadre (Brest est au bord sur mobile)
      ansuz.style.transform = `translate(${gx}px, ${Math.max(0, y - ansuz.offsetHeight - bob)}px)` +
        (gauche ? " scaleX(-1)" : "");
      ansuz.src = marche ? poses[Math.floor(t / 170) % 2] : poses[0];
    }
    function annoncer(texte) {
      bulle.textContent = texte;
      bulle.classList.remove("vu"); void bulle.offsetWidth; bulle.classList.add("vu");
    }
    function marcherVers(cible) {
      return new Promise(resolve => {
        const depart = pos.slice(), t0 = performance.now();
        const dist = Math.hypot(cible[0] - depart[0], cible[1] - depart[1]);
        const duree = Math.max(700, Math.min(1800, dist * 2.2));
        const gauche = cible[0] < depart[0];
        function pas(t) {
          const u = Math.min((t - t0) / duree, 1), e = u * u * (3 - 2 * u);
          pos = [depart[0] + (cible[0] - depart[0]) * e, depart[1] + (cible[1] - depart[1]) * e];
          placer(pos, t, u < 1, gauche);
          if (u < 1) requestAnimationFrame(pas); else resolve();
        }
        requestAnimationFrame(pas);
      });
    }

    zone.querySelectorAll("[data-cx]").forEach(el => {
      el.addEventListener("click", async ev => {
        ev.preventDefault();
        if (enRoute) return;
        const cible = [parseFloat(el.dataset.cx), parseFloat(el.dataset.cy)];
        const nom = el.dataset.nom;
        enRoute = true;
        if (el.dataset.href) annoncer(`Direction : ${nom} !`);
        await marcherVers(cible);
        if (el.dataset.href) location.href = el.dataset.href;
        else { annoncer(`${nom} : bientôt ! Ansuz n'y est pas encore allé.`); enRoute = false; }
      });
    });

    ansuz.hidden = false;
    placer(pos, 0, false, false);
    window.addEventListener("resize", () => placer(pos, 0, false, false));
  });
})();
