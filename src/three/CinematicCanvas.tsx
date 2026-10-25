// Cinematic ambient scene for the Home experience — real Three.js/WebGL.
// A wireframe "revenue globe" with glowing city arcs, orbiting satellites,
// an additive particle field and a nebula gradient backdrop.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface CinematicHandle {
  /** 0..1 progress through the pinned chapter sequence */
  setProgress(p: number): void;
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function makeGlowTexture(inner: string, outer: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}
function makeDotTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(190,205,255,0.85)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

// Great-arc control point between two sphere points (bowed outward)
function arcCurve(a: THREE.Vector3, b: THREE.Vector3, lift: number) {
  const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(a.length() * lift);
  return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
}
const pointOnSphere = (r: number) => {
  const u = Math.random() * 2 - 1;
  const theta = Math.random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return new THREE.Vector3(s * Math.cos(theta) * r, u * r, s * Math.sin(theta) * r);
};

export default function CinematicCanvas({ progressRef, className }: {
  progressRef: React.MutableRefObject<number>;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const motion = !reducedMotion();

    // ---------- renderer / scene / camera ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070b23, 0.075);

    const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(0, 1.6, 13);

    // ---------- lights ----------
    scene.add(new THREE.AmbientLight(0x8899ff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(6, 8, 7); scene.add(key);
    const rim = new THREE.DirectionalLight(0x22d3ee, 1.1); rim.position.set(-7, -2, -6); scene.add(rim);
    const core = new THREE.PointLight(0x6366f1, 30, 30, 1.6); core.position.set(0, 0, 0); scene.add(core);

    // ---------- nebula backdrop sphere ----------
    const nebula = new THREE.Mesh(
      new THREE.SphereGeometry(70, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x0b1030, side: THREE.BackSide })
    );
    scene.add(nebula);

    // ---------- revenue globe ----------
    const globe = new THREE.Group();
    const R = 3.1;
    const wire = new THREE.Mesh(
      new THREE.SphereGeometry(R, 36, 26),
      new THREE.MeshBasicMaterial({ color: 0x4f46e5, wireframe: true, transparent: true, opacity: 0.34 })
    );
    globe.add(wire);
    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.985, 48, 32),
      new THREE.MeshStandardMaterial({ color: 0x131a4e, emissive: 0x1e1b4b, emissiveIntensity: 0.9, roughness: 0.42, metalness: 0.55, transparent: true, opacity: 0.96 })
    );
    globe.add(inner);
    // glowing latitude rings
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.5 });
    [-0.62, -0.34, 0, 0.34, 0.62].forEach((lat, i) => {
      const r = R * Math.cos(lat) * 1.001;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 8, 80), ringMat.clone());
      (ring.material as THREE.MeshBasicMaterial).opacity = i === 2 ? 0.75 : 0.32;
      ring.rotation.x = Math.PI / 2;
      ring.position.y = R * Math.sin(lat);
      globe.add(ring);
    });
    // city hub points + points cloud
    const dotTex = makeDotTexture();
    const hubPositions: THREE.Vector3[] = [];
    for (let i = 0; i < 26; i++) hubPositions.push(pointOnSphere(R * 1.01));
    // cluster hubs near "retail markets" (bias toward northern hemisphere)
    hubPositions.forEach(v => { v.y = Math.abs(v.y) * 0.9 + (Math.random() - 0.35) * R * 0.6; v.normalize().multiplyScalar(R * 1.01); });
    const hubGeo = new THREE.BufferGeometry().setFromPoints(hubPositions);
    const hubs = new THREE.Points(hubGeo, new THREE.PointsMaterial({ map: dotTex, color: 0x67e8f9, size: 0.34, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    globe.add(hubs);
    // surface point-cloud (continents, abstract)
    const surf: number[] = [];
    for (let i = 0; i < 1500; i++) { const p = pointOnSphere(R * 1.002); surf.push(p.x, p.y, p.z); }
    const surfGeo = new THREE.BufferGeometry();
    surfGeo.setAttribute('position', new THREE.Float32BufferAttribute(surf, 3));
    const surfPts = new THREE.Points(surfGeo, new THREE.PointsMaterial({ map: dotTex, color: 0xa5b4fc, size: 0.075, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    globe.add(surfPts);
    scene.add(globe);

    // ---------- arcs between hubs ----------
    const arcGroup = new THREE.Group();
    const arcMat = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
    const arcs: { curve: THREE.QuadraticBezierCurve3; mesh: THREE.Line; t: number; speed: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const a = hubPositions[Math.floor(Math.random() * hubPositions.length)];
      let b = hubPositions[Math.floor(Math.random() * hubPositions.length)];
      if (a === b) b = hubPositions[(hubPositions.indexOf(a) + 7) % hubPositions.length];
      const curve = arcCurve(a, b, 1.28 + Math.random() * 0.32);
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
      const mesh = new THREE.Line(geo, arcMat.clone());
      arcGroup.add(mesh);
      arcs.push({ curve, mesh, t: Math.random(), speed: 0.0016 + Math.random() * 0.0022 });
    }
    // moving pulses along arcs
    const pulseTex = makeGlowTexture('rgba(255,255,255,1)', 'rgba(34,211,238,0.55)');
    const pulses: { sprite: THREE.Sprite; arc: (typeof arcs)[number]; offset: number }[] = [];
    arcs.forEach(arc => {
      const sm = new THREE.SpriteMaterial({ map: pulseTex, color: 0xa5f3fc, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const sprite = new THREE.Sprite(sm);
      sprite.scale.setScalar(0.42);
      arcGroup.add(sprite);
      pulses.push({ sprite, arc, offset: Math.random() });
    });
    globe.add(arcGroup);

    // ---------- orbiting data satellites ----------
    const satellites = new THREE.Group();
    const satColors = [0x818cf8, 0x22d3ee, 0xc084fc];
    const sats: { mesh: THREE.Mesh; radius: number; speed: number; phase: number; tilt: number }[] = [];
    satColors.forEach((c, i) => {
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16 + i * 0.05),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.35, roughness: 0.3, metalness: 0.4 })
      );
      satellites.add(mesh);
      sats.push({ mesh, radius: 4.4 + i * 0.75, speed: 0.0035 - i * 0.0009, phase: (i * Math.PI * 2) / 3, tilt: 0.42 + i * 0.24 });
    });
    globe.add(satellites);

    // ---------- particle starfield ----------
    const starCount = 1000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) starPos[i] = (Math.random() - 0.5) * 90;
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ map: dotTex, color: 0xdde4ff, size: 0.14, transparent: true, opacity: 0.9, depthWrite: false }));
    scene.add(stars);

    // ---------- floating holographic bar-chart monument ----------
    const monument = new THREE.Group();
    const barMat = new THREE.MeshStandardMaterial({ color: 0x6366f1, emissive: 0x4338ca, emissiveIntensity: 1.15, roughness: 0.25, metalness: 0.35, transparent: true, opacity: 0.92 });
    const barHeights = [1.15, 1.9, 1.5, 2.6, 2.15, 3.15, 2.8];
    barHeights.forEach((h, i) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.34, h, 0.34), barMat.clone());
      (bar.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.85 + i * 0.14;
      bar.position.set(-1.35 + i * 0.45, h / 2 - 1.5, 0);
      monument.add(bar);
    });
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.9, 2.15, 0.09, 48),
      new THREE.MeshStandardMaterial({ color: 0x1e1b4b, emissive: 0x312e81, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.6 })
    );
    base.position.y = -1.56;
    monument.add(base);
    monument.position.set(6.3, -0.7, 1.2);
    scene.add(monument);

    // ---------- mouse parallax ----------
    const mouse = { x: 0, y: 0 };
    const onMouse = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouse);

    // ---------- camera choreography keyed to scroll progress ----------
    // progress 0: wide establishing shot · 0.33: dive to globe · 0.66: orbital sweep · 1: pull back hero
    const camPath = (p: number) => {
      const ease = (a: number, b: number, t: number) => a + (b - a) * t;
      const seg = p < 0.333 ? 0 : p < 0.666 ? 1 : 2;
      const local = seg === 0 ? p / 0.333 : seg === 1 ? (p - 0.333) / 0.333 : (p - 0.666) / 0.334;
      const s = local * local * (3 - 2 * local); // smoothstep
      if (seg === 0) return { x: ease(0, 4.6, s), y: ease(1.7, 1.15, s), z: ease(13, 8.6, s), look: new THREE.Vector3(0, 0.1, 0) };
      if (seg === 1) { const ang = ease(0.35, 2.25, s); const r = ease(8.6, 6.6, s); return { x: Math.sin(ang) * r, y: ease(1.15, 2.6, s), z: Math.cos(ang) * r, look: new THREE.Vector3(0, 0.35, 0) }; }
      return { x: ease(Math.sin(2.25) * 6.6, 0, s), y: ease(2.6, 1.75, s), z: ease(Math.cos(2.25) * 6.6, 12.4, s), look: new THREE.Vector3(0, 0, 0) };
    };

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      const scrollP = progressRef.current;

      if (motion) {
        globe.rotation.y += 0.0022;
        arcs.forEach(a => { a.t = (a.t + a.speed) % 1; });
        pulses.forEach(p => {
          const local = (p.offset + t * 0.12) % 1;
          p.sprite.position.copy(p.arc.curve.getPoint(local));
          const s = 0.2 + Math.sin(local * Math.PI) * 0.4;
          p.sprite.scale.setScalar(s);
        });
        sats.forEach(s => {
          const a = t * s.speed * 60 + s.phase;
          s.mesh.position.set(Math.cos(a) * s.radius, Math.sin(a * 0.9 + s.tilt) * 1.6, Math.sin(a) * s.radius);
          s.mesh.rotation.x += 0.02; s.mesh.rotation.y += 0.03;
        });
        monument.rotation.y = Math.sin(t * 0.28) * 0.14;
        stars.rotation.y = t * 0.004;
        nebula.rotation.y = t * 0.002;
      }

      const cam = camPath(Math.min(1, Math.max(0, scrollP)));
      const mx = motion ? mouse.x : 0, my = motion ? mouse.y : 0;
      camera.position.x += (cam.x + mx * 0.55 - camera.position.x) * 0.055;
      camera.position.y += (cam.y - my * 0.4 - camera.position.y) * 0.055;
      camera.position.z += (cam.z - camera.position.z) * 0.055;
      camera.lookAt(cam.look);

      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouse);
      ro.disconnect();
      renderer.dispose();
      scene.traverse(obj => {
        const anyObj = obj as any;
        if (anyObj.geometry) anyObj.geometry.dispose();
        if (anyObj.material) {
          const mats = Array.isArray(anyObj.material) ? anyObj.material : [anyObj.material];
          mats.forEach((m: any) => { if (m.map) m.map.dispose(); m.dispose(); });
        }
      });
      mount.removeChild(renderer.domElement);
    };
  }, [progressRef]);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
