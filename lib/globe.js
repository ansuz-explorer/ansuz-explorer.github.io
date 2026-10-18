// Page d'accueil : globe terrestre qui tourne, choix d'un continent ou d'un pays,
// Ansuz marche jusqu'au pays choisi puis ouvre sa page.
(async function () {
  const conf = window.GLOBE;                 // injecté par build.py : pays visités, noms FR, continents
  const svg = d3.select("#globe");
  const bulle = document.getElementById("bulle");
  const ansuz = document.getElementById("ansuz-marche");
  const size = () => Math.min(svg.node().clientWidth, svg.node().clientHeight);

  const world = await (await fetch("/lib/countries-110m.json")).json();
  const pays = topojson.feature(world, world.objects.countries).features;
  const proj = d3.geoOrthographic().clipAngle(90).precision(0.5);
  const path = d3.geoPath(proj);
  const graticule = d3.geoGraticule10();

  const defs = svg.append("defs");
  const grad = defs.append("radialGradient").attr("id", "ocean").attr("cx", "35%").attr("cy", "30%");
  grad.append("stop").attr("offset", "0%").attr("stop-color", "#2c5a91");
  grad.append("stop").attr("offset", "100%").attr("stop-color", "#12284a");
  // quand on zoome, le globe garde sa silhouette ronde
  const disque = defs.append("clipPath").attr("id", "disque").append("circle");
  const monde = svg.append("g").attr("clip-path", "url(#disque)");
  const sphere = monde.append("path").datum({ type: "Sphere" }).attr("class", "sphere").attr("fill", "url(#ocean)");
  const grille = monde.append("path").datum(graticule).attr("class", "graticule");
  const terres = monde.append("g").selectAll("path").data(pays).join("path")
    .attr("class", d => conf.visites[d.id] ? "pays visite" : conf.prochain[d.id] ? "pays prochain" : "pays")
    .on("mousemove", (ev, d) => montrerBulle(ev, d))
    .on("mouseleave", () => bulle.hidden = true)
    .on("click", (ev, d) => choisir(d));

  let rot = [-2, -30, 0];                     // on démarre au-dessus de l'Europe
  let base = 1, zoom = 1;                     // zoom > 1 : le pays choisi s'agrandit
  function taille() {
    base = size() / 2 - 8;
    proj.translate([svg.node().clientWidth / 2, svg.node().clientHeight / 2]);
    disque.attr("cx", svg.node().clientWidth / 2).attr("cy", svg.node().clientHeight / 2).attr("r", base);
    dessiner();
  }
  function dessiner() {
    proj.scale(base * zoom).rotate(rot);
    sphere.attr("d", path);
    grille.attr("d", path);
    terres.attr("d", path);
  }

  function nomFr(d) { return conf.noms[d.id] || d.properties.name; }
  function montrerBulle(ev, d) {
    const v = conf.visites[d.id] || conf.prochain[d.id];
    bulle.innerHTML = v ? `<strong>${nomFr(d)}</strong><br>${v.texte}` : `<strong>${nomFr(d)}</strong><br>Bientôt : Ansuz n'est pas encore passé par ici`;
    bulle.hidden = false;
    bulle.style.left = ev.clientX + 14 + "px";
    bulle.style.top = ev.clientY + 14 + "px";
  }

  // rotation automatique, arrêtée dès que l'utilisateur prend la main
  let auto = true, occupe = false;
  d3.timer(() => { if (auto && !occupe) { rot[0] += 0.12; dessiner(); } });

  // glisser pour tourner le globe
  svg.call(d3.drag()
    .on("start", () => { auto = false; ansuz.hidden = true; })
    .on("drag", ev => {
      const k = 90 / proj.scale();
      rot = [rot[0] + ev.dx * k, Math.max(-80, Math.min(80, rot[1] - ev.dy * k)), 0];
      dessiner();
    }));

  function tournerVers(lonlat, zoomCible = 1, duree = 1400) {
    const cible = [-lonlat[0], -lonlat[1], 0];
    const interp = d3.interpolate(rot, cible), iz = d3.interpolate(zoom, zoomCible);
    occupe = true;
    return d3.transition().duration(duree).ease(d3.easeCubicInOut)
      .tween("rotate", () => t => { rot = interp(t); zoom = iz(t); dessiner(); })
      .end().catch(() => {}).finally(() => { occupe = false; });  // interrompue par un autre clic : pas une erreur
  }

  // Ansuz court du bord de l'écran jusqu'au pays (au centre du globe) et s'arrête les pieds dessus
  function marcher(poses = conf.poses, vitesse = 170) {
    return new Promise(resolve => {
      ansuz.src = poses[0];
      ansuz.hidden = false;
      const box = svg.node().getBoundingClientRect();
      const h = ansuz.offsetHeight || 130;
      const x1 = box.left + box.width / 2 - ansuz.offsetWidth / 2, y = box.top + box.height / 2 - h * 0.8;
      const x0 = -120;
      const t0 = performance.now(), duree = 1500;
      function pas(t) {
        const u = Math.min((t - t0) / duree, 1);
        const e = u * u * (3 - 2 * u);
        ansuz.style.transform = `translate(${x0 + (x1 - x0) * e}px, ${y - Math.abs(Math.sin(t / 110)) * 10}px)`;
        ansuz.src = poses[Math.floor(t / vitesse) % 2];
        if (u < 1) requestAnimationFrame(pas); else { ansuz.src = poses[0]; ansuz.style.transform = `translate(${x1}px, ${y}px)`; resolve(); }
      }
      requestAnimationFrame(pas);
    });
  }

  async function choisir(d) {
    auto = false;
    bulle.hidden = true;
    const v = conf.visites[d.id], p = conf.prochain[d.id];
    ansuz.hidden = true;
    if (p) montrerFiche(p);                   // la fiche s'affiche avant la course (sinon la page bouge sous Ansuz)
    await tournerVers(v ? v.centre : p ? p.centre : d3.geoCentroid(d), v || p ? 2.6 : 1);
    if (p) {  // prochaine destination : Ansuz court jusqu'au pays avec sa tenue du pays et y reste
      annoncer(`${nomFr(d)} ? Vote pour ce pays en commentaire !`);
      await marcher(p.poses, 110);
      return;
    }
    if (!v) { annoncer(`${nomFr(d)} : bientôt ! Ansuz commence par la France.`); return; }
    annoncer(`Direction : ${nomFr(d)} !`);
    await marcher();
    location.href = v.url;
  }

  // fiche du pays candidat : de quoi donner envie de voter pour lui
  const fiche = document.getElementById("fiche-pays");
  function montrerFiche(p) {
    document.querySelectorAll(".candidat").forEach(b => b.classList.toggle("choisi", conf.prochain[b.dataset.pays] === p));
    if (!fiche || !p.fiche) return;
    const f = p.fiche;
    fiche.innerHTML = `<h3>${p.nom}</h3><p>${f.accroche}</p>` +
      `<p class="decoupage"><strong>Le pays :</strong> ${f.decoupage}.<br><strong>À explorer :</strong> ${f.regions}</p>` +
      `<p class="decoupage"><strong>Les bâtiments qu'Ansuz pourrait te raconter :</strong></p>` +
      `<ul>${f.batiments.map(([n, t]) => `<li><strong>${n}</strong> · ${t}</li>`).join("")}</ul>` +
      `<p class="vote-fiche">Tu veux qu'Ansuz y aille ? Écris <strong>${p.nom}</strong> en commentaire !</p>`;
    fiche.hidden = false;
  }

  function annoncer(texte) {
    const a = document.getElementById("annonce");
    a.textContent = texte;
    a.classList.remove("vu"); void a.offsetWidth; a.classList.add("vu");
  }

  // boutons continents
  document.querySelectorAll("[data-continent]").forEach(b => b.addEventListener("click", async () => {
    auto = false;
    const c = conf.continents[b.dataset.continent];
    ansuz.hidden = true;
    await tournerVers(c.centre);
    annoncer(c.message);
  }));
  // boutons des pays visités
  document.querySelectorAll("[data-pays]").forEach(b => b.addEventListener("click", () => {
    const d = pays.find(p => p.id === b.dataset.pays);
    // sur téléphone le globe est au-dessus des boutons : on remonte pour voir Ansuz courir
    if (svg.node().getBoundingClientRect().top < 0) svg.node().scrollIntoView({ behavior: "smooth", block: "center" });
    if (d) choisir(d);
  }));

  window.addEventListener("resize", () => { ansuz.hidden = true; taille(); });
  // Ansuz est positionné sur l'écran : si on fait vraiment défiler la page, il disparaît
  let yPose = 0;
  new MutationObserver(() => { if (!ansuz.hidden) yPose = scrollY; }).observe(ansuz, { attributes: true, attributeFilter: ["hidden"] });
  window.addEventListener("scroll", () => { if (Math.abs(scrollY - yPose) > 60) ansuz.hidden = true; }, { passive: true });
  taille();
})();
