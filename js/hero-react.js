(function () {
  const mount = document.getElementById("hero-react-stage");
  if (!mount || !window.THREE) return;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 100); camera.position.z = 4.3;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; mount.appendChild(renderer.domElement);

  const c = document.createElement("canvas"); c.width = c.height = 1024; const x = c.getContext("2d");
  x.fillStyle = "#d7651d"; x.fillRect(0, 0, 1024, 1024); x.globalAlpha = .18;
  for (let i = 0; i < 9000; i++) { x.fillStyle = i % 2 ? "#3a1408" : "#f3a05a"; const s = Math.random() * 2 + 1; x.fillRect(Math.random() * 1024, Math.random() * 1024, s, s); }
  x.globalAlpha = 1; x.strokeStyle = "#24100a"; x.lineWidth = 18; x.lineCap = "round";
  x.beginPath(); x.moveTo(0, 512); x.bezierCurveTo(270, 350, 700, 680, 1024, 500); x.stroke(); x.beginPath(); x.moveTo(200, 0); x.bezierCurveTo(430, 270, 600, 760, 780, 1024); x.stroke(); x.beginPath(); x.arc(512, 512, 300, -.8, 1.2); x.stroke();
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.18, 96, 64), new THREE.MeshStandardMaterial({ map: texture, roughness: .72, metalness: .02, bumpMap: texture, bumpScale: .025 })); scene.add(ball);
  scene.add(new THREE.HemisphereLight(0xffd7b0, 0x080b12, 1.2)); const key = new THREE.DirectionalLight(0xffb36b, 3.2); key.position.set(-3, 4, 5); scene.add(key); const rim = new THREE.PointLight(0xff5b17, 4, 8); rim.position.set(3, -1, 3); scene.add(rim);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.35, 64), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .28, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, -1.48, 0); shadow.scale.set(1.4, .34, 1); scene.add(shadow);
  const pointer = { x: 0, y: 0 }, target = { x: 0, y: 0 }; const move = (px, py, r) => { target.x = ((px - r.left) / r.width - .5) * 2; target.y = ((py - r.top) / r.height - .5) * 2; };
  mount.addEventListener("pointermove", e => move(e.clientX, e.clientY, mount.getBoundingClientRect()), { passive: true }); mount.addEventListener("pointerleave", () => { target.x = 0; target.y = 0; }, { passive: true });
  function resize() { const r = mount.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); } new ResizeObserver(resize).observe(mount); resize();
  const clock = new THREE.Clock(); function frame() { const t = clock.getElapsedTime(); pointer.x += (target.x - pointer.x) * .045; pointer.y += (target.y - pointer.y) * .045; ball.rotation.y += .006; ball.rotation.x += .0017; ball.rotation.z = Math.sin(t * .55) * .035; ball.position.x += (pointer.x * .22 - ball.position.x) * .035; ball.position.y += (-pointer.y * .16 + Math.sin(t * 1.2) * .035 - ball.position.y) * .035; ball.scale.setScalar(1 + pointer.y * -.025); camera.position.x += (pointer.x * .08 - camera.position.x) * .025; camera.position.y += (-pointer.y * .05 - camera.position.y) * .025; camera.lookAt(0, 0, 0); shadow.position.x += (ball.position.x * .35 - shadow.position.x) * .04; shadow.scale.x = 1.4 - ball.position.y * .08; renderer.render(scene, camera); requestAnimationFrame(frame); } frame();
})();
