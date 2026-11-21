/* Scenari | Space Economy — livello 3D (three.js r128)
   Terra3D: la Terra di notte con atmosfera, orbite e satelliti; la camera scende
   sull'Italia seguendo l'avanzamento dello scroll (setProgress 0 → 1).
   Satellite3D: un satellite in lamina d'oro che ruota con lo scroll e col mouse.
   Texture della Terra dagli esempi di three.js (immagini NASA). */
(function () {
  if (!window.THREE) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var css = getComputedStyle(document.documentElement);
  function tok(name, fallback) { var v = css.getPropertyValue(name).trim(); return new THREE.Color(v || fallback); }
  var C = {
    notte: tok('--space-0', '#05060F'),
    lime: tok('--oe-lime-400', '#B9FF69'),
    testo: tok('--space-text-muted', '#C9CCEB')
  };
  function supportaWebGL() {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; }
  }
  if (!supportaWebGL()) return;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }
  function seg(p, a, b) { return smooth((p - a) / (b - a)); }

  function rendererPer(canvas, alpha) {
    var r = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: !!alpha, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    return r;
  }
  function quandoVisibile(el, cb) {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    new IntersectionObserver(function (es) { cb(es[0].isIntersecting); }, { rootMargin: '200px 0px' }).observe(el);
  }

  /* ============================== TERRA ============================== */
  window.Terra3D = {
    init: function (canvas, base) {
      var renderer = rendererPer(canvas, false);
      renderer.setClearColor(C.notte, 1);
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(32, 1, 0.01, 1000);

      /* Stelle */
      var sg = new THREE.BufferGeometry(), sp = [];
      for (var i = 0; i < 2600; i++) {
        var u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 300;
        sp.push(r * Math.sqrt(1 - u * u) * Math.cos(th), r * u, r * Math.sqrt(1 - u * u) * Math.sin(th));
      }
      sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      var stelle = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, sizeAttenuation: true, transparent: true, opacity: 0.8 }));
      scene.add(stelle);

      /* Terra: un gruppo per l'inclinazione (latitudine), uno per la rotazione (longitudine) */
      var tilt = new THREE.Group(); scene.add(tilt);
      var spin = new THREE.Group(); tilt.add(spin);
      var loader = new THREE.TextureLoader();
      var giorno = loader.load(base + '3d/terra-giorno.jpg');
      var luci = loader.load(base + '3d/terra-luci.jpg');
      [giorno, luci].forEach(function (t) { t.anisotropy = renderer.capabilities.getMaxAnisotropy(); });
      var terraMat = new THREE.ShaderMaterial({
        uniforms: { giorno: { value: giorno }, luci: { value: luci }, rim: { value: new THREE.Color(0x3d6bff) } },
        vertexShader: [
          'varying vec2 vUv; varying vec3 vN; varying vec3 vV;',
          'void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0);',
          'vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }'
        ].join('\n'),
        fragmentShader: [
          'uniform sampler2D giorno; uniform sampler2D luci; uniform vec3 rim;',
          'varying vec2 vUv; varying vec3 vN; varying vec3 vV;',
          'void main(){',
          '  vec3 d = texture2D(giorno, vUv).rgb; vec3 l = texture2D(luci, vUv).rgb;',
          '  float lum = dot(l, vec3(0.299,0.587,0.114));',
          '  vec3 col = d * vec3(0.045,0.06,0.12) + vec3(1.0,0.74,0.38) * pow(lum, 1.35) * 2.1;',
          '  float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);',
          '  col += rim * f * 0.9;',
          '  gl_FragColor = vec4(col, 1.0); }'
        ].join('\n')
      });
      var terra = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), terraMat);
      spin.add(terra);

      /* Atmosfera: alone sul bordo, dal blu al lime */
      var atmo = new THREE.Mesh(new THREE.SphereGeometry(1.06, 96, 64), new THREE.ShaderMaterial({
        uniforms: { blu: { value: new THREE.Color(0x3d6bff) }, lime: { value: C.lime } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 blu; uniform vec3 lime; varying vec3 vN; varying vec3 vV; void main(){ float d = dot(vN, vV); float a = pow(clamp(1.0 + d, 0.0, 1.0), 5.0); float edge = smoothstep(0.0, 0.25, -d); vec3 c = mix(blu, lime, smoothstep(0.55, 1.0, a) * 0.35); gl_FragColor = vec4(c, a * edge * 1.2); }',
        side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
      }));
      tilt.add(atmo);

      /* Orbite: bassa inclinata, polare, eliosincrona, geostazionaria */
      var orbite = new THREE.Group(); scene.add(orbite);
      var satelliti = [];
      function orbita(raggio, incl, nodo, colore, opacita, nSat, vel) {
        var g = new THREE.Group();
        g.rotation.set(incl, nodo, 0, 'YXZ');
        var pts = [];
        for (var k = 0; k <= 256; k++) { var a = k / 256 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * raggio, 0, Math.sin(a) * raggio)); }
        var mat = new THREE.LineBasicMaterial({ color: colore, transparent: true, opacity: opacita });
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
        var pg = new THREE.BufferGeometry();
        pg.setAttribute('position', new THREE.Float32BufferAttribute(new Array(nSat * 3).fill(0), 3));
        var pm = new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, transparent: true, opacity: 1 });
        var punti = new THREE.Points(pg, pm);
        g.add(punti);
        orbite.add(g);
        satelliti.push({ geo: pg, n: nSat, r: raggio, vel: vel, fase: Math.random() * 6.28, mats: [mat, pm], opa: opacita });
      }
      orbita(1.32, 0.9, 0.3, C.testo, 0.32, 3, 0.22);
      orbita(1.42, 1.57, 1.2, C.testo, 0.28, 2, 0.18);
      orbita(1.55, 1.72, -0.6, C.lime, 0.42, 2, 0.15);
      orbita(1.38, 0.35, 2.1, C.testo, 0.22, 4, 0.2);
      orbita(2.6, 0.08, 0.0, C.testo, 0.2, 5, 0.04);

      /* Coordinate di arrivo: Italia centrale (lat 42°, lon 12.5°) */
      function rotPer(lon) {
        var u = (lon + 180) / 360, phi = u * Math.PI * 2;
        var x = -Math.cos(phi), z = Math.sin(phi);
        return -Math.atan2(x, z);
      }
      var lonStart = -35, lonEnd = 12.5, latStart = 18 * Math.PI / 180, latEnd = 42 * Math.PI / 180;
      var progress = 0, mostrata = 0, visibile = true, t0 = performance.now();
      var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
      window.addEventListener('pointermove', function (e) { mouse.tx = e.clientX / window.innerWidth - .5; mouse.ty = e.clientY / window.innerHeight - .5; }, { passive: true });

      function misura() {
        var w = canvas.clientWidth, h = canvas.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h; camera.updateProjectionMatrix();
      }
      window.addEventListener('resize', misura);
      misura();

      var guarda = new THREE.Vector3();
      function frame(now) {
        var t = (now - t0) / 1000;
        mostrata += (progress - mostrata) * (reduce ? 1 : 0.09);
        var p = mostrata;
        mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;

        /* Rotazione: lenta deriva all'inizio, poi l'Italia viene al centro */
        var giro = seg(p, 0.05, 0.62);
        var deriva = reduce ? 0 : t * 0.025 * (1 - giro);
        spin.rotation.y = lerp(rotPer(lonStart), rotPer(lonEnd), giro) + deriva;
        tilt.rotation.x = lerp(latStart, latEnd, seg(p, 0.1, 0.7));

        /* Camera: dallo spazio profondo a una vista obliqua verso nord */
        var discesa = seg(p, 0.12, 0.95);
        var wide = camera.aspect > 1.1;
        var dist = lerp(wide ? 7.2 : 9.5, 1.62, Math.pow(discesa, 0.85));
        var offX = lerp(wide ? -1.05 : 0, 0, seg(p, 0.05, 0.55));
        var offY = lerp(wide ? 0 : -0.9, 0, seg(p, 0.05, 0.55));
        var basso = lerp(0, -0.52, seg(p, 0.55, 0.98));
        camera.position.set(offX + mouse.x * 0.15 * (1 - discesa), offY + basso - mouse.y * 0.1 * (1 - discesa), dist);
        guarda.set(offX, offY + lerp(0, 0.5, seg(p, 0.55, 0.98)), lerp(0, 0.86, seg(p, 0.55, 0.98)));
        camera.lookAt(guarda);

        /* Orbite e satelliti: girano, e svaniscono quando si scende */
        var fade = 1 - seg(p, 0.5, 0.78);
        orbite.visible = fade > 0.01;
        orbite.rotation.copy(tilt.rotation);
        satelliti.forEach(function (o) {
          var arr = o.geo.attributes.position.array;
          for (var k = 0; k < o.n; k++) {
            var a = o.fase + k / o.n * Math.PI * 2 + (reduce ? 0 : t * o.vel);
            arr[k * 3] = Math.cos(a) * o.r; arr[k * 3 + 1] = 0; arr[k * 3 + 2] = Math.sin(a) * o.r;
          }
          o.geo.attributes.position.needsUpdate = true;
          o.mats[0].opacity = o.opa * fade; o.mats[1].opacity = fade;
        });
        stelle.material.opacity = 0.8 * (1 - seg(p, 0.6, 0.9));

        renderer.render(scene, camera);
        if (visibile && !reduce) requestAnimationFrame(frame);
      }
      quandoVisibile(canvas, function (v) { var era = visibile; visibile = v; if (v && !era) requestAnimationFrame(frame); });
      requestAnimationFrame(frame);
      return {
        setProgress: function (p) { progress = p; if (reduce) requestAnimationFrame(frame); },
        resize: misura
      };
    }
  };

  /* ============================== SATELLITE ============================== */
  window.Satellite3D = {
    init: function (canvas) {
      var renderer = rendererPer(canvas, true);
      renderer.setClearColor(0x000000, 0);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.9;
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      camera.position.set(0, 0.45, 8.2);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.HemisphereLight(0x6f86ff, 0x0b0820, 0.5));
      var sole = new THREE.DirectionalLight(0xfff1d6, 2.6); sole.position.set(4, 3, 5); scene.add(sole);
      var contro = new THREE.DirectionalLight(C.lime, 0.9); contro.position.set(-5, -1, -4); scene.add(contro);
      var blu = new THREE.DirectionalLight(0x3d6bff, 0.8); blu.position.set(-3, 4, 2); scene.add(blu);

      var pm = new THREE.PMREMGenerator(renderer);
      var amb = new THREE.Scene();
      var cielo = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
      var cols = [], pos = cielo.geometry.attributes.position;
      for (var i = 0; i < pos.count; i++) { var y = pos.getY(i) / 10; var c = y > 0.35 ? new THREE.Color(0xfff3dc).multiplyScalar(0.12 + y * 0.5) : new THREE.Color(0x0c1240).multiplyScalar(0.35 + Math.abs(y) * 0.3); cols.push(c.r, c.g, c.b); }
      cielo.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      amb.add(cielo);
      scene.environment = pm.fromScene(amb, 0.04).texture;
      var sat = new THREE.Group(); scene.add(sat);

      /* Lamina d'oro: texture a pieghe disegnata su canvas */
      function lamina() {
        var c = document.createElement('canvas'); c.width = c.height = 256;
        var x = c.getContext('2d');
        var g = x.createLinearGradient(0, 0, 256, 256);
        g.addColorStop(0, '#7a5414'); g.addColorStop(.45, '#e0b34a'); g.addColorStop(.6, '#f3d06a'); g.addColorStop(1, '#6e4a10');
        x.fillStyle = g; x.fillRect(0, 0, 256, 256);
        /* pieghe: sfaccettature triangolari con riflessi diversi */
        for (var i = 0; i < 520; i++) {
          var cx = Math.random() * 256, cy = Math.random() * 256, r = 8 + Math.random() * 26;
          var l = Math.random();
          x.fillStyle = l > .7 ? 'rgba(255,238,170,' + (.25 + Math.random() * .35) + ')' : l < .35 ? 'rgba(60,36,4,' + (.25 + Math.random() * .4) + ')' : 'rgba(214,160,52,' + (.2 + Math.random() * .3) + ')';
          x.beginPath();
          for (var v = 0; v < 3; v++) { var a = Math.random() * 6.28; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
          x.closePath(); x.fill();
        }
        var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
      }
      function pannello() {
        var c = document.createElement('canvas'); c.width = 512; c.height = 192;
        var x = c.getContext('2d');
        x.fillStyle = '#0a1030'; x.fillRect(0, 0, 512, 192);
        for (var i = 0; i < 16; i++) for (var j = 0; j < 6; j++) {
          x.fillStyle = 'rgb(' + (18 + Math.random() * 10) + ',' + (32 + Math.random() * 14) + ',' + (88 + Math.random() * 30) + ')';
          x.fillRect(i * 32 + 2, j * 32 + 2, 28, 28);
        }
        var tp = new THREE.CanvasTexture(c); tp.encoding = THREE.sRGBEncoding; return tp;
      }
      var oro = new THREE.MeshStandardMaterial({ map: lamina(), metalness: 0.9, roughness: 0.28, color: 0xffffff, envMapIntensity: 0.9 });
      var argento = new THREE.MeshStandardMaterial({ color: 0xb9bccb, metalness: 0.75, roughness: 0.4, envMapIntensity: 0.6 });
      var celle = new THREE.MeshStandardMaterial({ map: pannello(), metalness: 0.3, roughness: 0.35, envMapIntensity: 0.35 });
      var bianco = new THREE.MeshStandardMaterial({ color: 0xe6e6ea, metalness: 0.1, roughness: 0.55, side: THREE.DoubleSide, envMapIntensity: 0.4 });

      var corpo = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 1), oro); sat.add(corpo);
      var tappo = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.08, 1.04), argento); tappo.position.y = 0.64; sat.add(tappo);
      var fondo = tappo.clone(); fondo.position.y = -0.64; sat.add(fondo);
      [-1, 1].forEach(function (s) {
        var braccio = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 12), argento);
        braccio.rotation.z = Math.PI / 2; braccio.position.x = s * 0.75; sat.add(braccio);
        var ala = new THREE.Group(); ala.position.x = s * 2.05; sat.add(ala);
        var p1 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.03, 0.82), [argento, argento, celle, celle, argento, argento]);
        ala.add(p1);
      });
      var parabola = new THREE.Mesh(new THREE.SphereGeometry(0.55, 40, 16, 0, Math.PI * 2, 0, 0.9), bianco);
      parabola.rotation.x = Math.PI; parabola.position.set(0, 0.98, 0.15); sat.add(parabola);
      var stelo = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), argento); stelo.position.set(0, 1.0, 0.15); sat.add(stelo);
      var antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8), argento); antenna.position.set(0.3, -0.95, 0.3); sat.add(antenna);
      var radiatore = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.9, 0.7), argento); radiatore.position.set(0.515, 0, 0); sat.add(radiatore);
      var rad2 = radiatore.clone(); rad2.position.x = -0.515; sat.add(rad2);
      for (var q = 0; q < 4; q++) { var ug = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 12, 1, true), argento); ug.position.set((q % 2 ? 1 : -1) * 0.32, -0.74, (q < 2 ? 1 : -1) * 0.32); sat.add(ug); }
      var sensore = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.3, 24), argento); sensore.rotation.x = Math.PI / 2; sensore.position.set(-0.2, 0.15, 0.62); sat.add(sensore);
      var lente = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshStandardMaterial({ color: 0x0b0f2a, metalness: 1, roughness: 0.05, envMapIntensity: 2 })); lente.position.set(-0.2, 0.15, 0.775); sat.add(lente);
      sat.rotation.set(0.25, -0.6, 0.08);

      var progress = 0, mostrata = 0, visibile = false, t0 = performance.now();
      var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
      canvas.parentElement.addEventListener('pointermove', function (e) {
        var r = canvas.getBoundingClientRect();
        mouse.tx = (e.clientX - r.left) / r.width - .5; mouse.ty = (e.clientY - r.top) / r.height - .5;
      });
      canvas.parentElement.addEventListener('pointerleave', function () { mouse.tx = mouse.ty = 0; });
      function misura() {
        var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      }
      window.addEventListener('resize', misura); misura();
      function frame(now) {
        var t = (now - t0) / 1000;
        mostrata += (progress - mostrata) * (reduce ? 1 : 0.08);
        mouse.x += (mouse.tx - mouse.x) * 0.06; mouse.y += (mouse.ty - mouse.y) * 0.06;
        sat.rotation.y = -0.6 + mostrata * Math.PI * 1.6 + mouse.x * 0.9 + (reduce ? 0 : t * 0.05);
        sat.rotation.x = 0.25 + mouse.y * 0.5;
        sat.position.y = reduce ? 0 : Math.sin(t * 0.8) * 0.08;
        renderer.render(scene, camera);
        if (visibile && !reduce) requestAnimationFrame(frame);
      }
      quandoVisibile(canvas, function (v) { var era = visibile; visibile = v; if (v && !era) requestAnimationFrame(frame); });
      requestAnimationFrame(frame);
      return { setProgress: function (p) { progress = p; if (reduce) requestAnimationFrame(frame); } };
    }
  };
})();
