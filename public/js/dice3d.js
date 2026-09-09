class ThreeDiceController {
  constructor(containerElement, rollBtnElement) {
    this.container = containerElement;
    this.btn = rollBtnElement;
    this.isRolling = false;
    this.isCharging = false;
    this.chargeRatio = 0;
    this.pendingCallback = null;
    this.rollTimeout = null;

    this.faceRotations = {
      1: { x: 0, y: 0, z: 0 },
      2: { x: 0, y: Math.PI, z: 0 },
      3: { x: 0, y: -Math.PI / 2, z: 0 },
      4: { x: 0, y: Math.PI / 2, z: 0 },
      5: { x: -Math.PI / 2, y: 0, z: 0 },
      6: { x: Math.PI / 2, y: 0, z: 0 }
    };

    this.initScene();
  }

  createFaceTexture(number) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");

    const bgGrad = ctx.createRadialGradient(128, 128, 20, 128, 128, 140);
    bgGrad.addColorStop(0, "#ffffff");
    bgGrad.addColorStop(1, "#f1e9ed");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 256, 256);

    ctx.lineWidth = 14;
    ctx.strokeStyle = "rgba(225, 29, 72, 0.35)";
    ctx.strokeRect(7, 7, 242, 242);

    const pips = {
      1: [[128, 128]],
      2: [[72, 72], [184, 184]],
      3: [[72, 72], [128, 128], [184, 184]],
      4: [[72, 72], [184, 72], [72, 184], [184, 184]],
      5: [[72, 72], [184, 72], [128, 128], [72, 184], [184, 184]],
      6: [[72, 64], [184, 64], [72, 128], [184, 128], [72, 192], [184, 192]]
    };

    const points = pips[number] || [];
    points.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fillStyle = number === 1 ? "#e11d48" : "#1f1418";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x - 5, y - 5, 7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.fill();
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
  }

  initScene() {
    const width = this.container.clientWidth || 110;
    const height = this.container.clientHeight || 110;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 4.4);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.innerHTML = "";
    this.container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight1.position.set(5, 8, 6);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xfda4af, 0.9);
    dirLight2.position.set(-5, -4, -4);
    this.scene.add(dirLight2);

    const materials = [
      new THREE.MeshStandardMaterial({ map: this.createFaceTexture(3), roughness: 0.2, metalness: 0.05 }),
      new THREE.MeshStandardMaterial({ map: this.createFaceTexture(4), roughness: 0.2, metalness: 0.05 }),
      new THREE.MeshStandardMaterial({ map: this.createFaceTexture(6), roughness: 0.2, metalness: 0.05 }),
      new THREE.MeshStandardMaterial({ map: this.createFaceTexture(5), roughness: 0.2, metalness: 0.05 }),
      new THREE.MeshStandardMaterial({ map: this.createFaceTexture(1), roughness: 0.2, metalness: 0.05 }),
      new THREE.MeshStandardMaterial({ map: this.createFaceTexture(2), roughness: 0.2, metalness: 0.05 })
    ];

    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    this.diceMesh = new THREE.Mesh(geometry, materials);
    this.scene.add(this.diceMesh);

    this.targetRotation = { x: 0.25, y: 0.35, z: 0 };
    this.currentRotation = { x: 0.25, y: 0.35, z: 0 };
    this.diceMesh.rotation.set(this.currentRotation.x, this.currentRotation.y, this.currentRotation.z);

    this.container.addEventListener("mousemove", (e) => {
      if (this.isRolling || this.isCharging) return;
      const rect = this.container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 0.7;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 0.7;
      this.diceMesh.rotation.y = this.currentRotation.y + nx;
      this.diceMesh.rotation.x = this.currentRotation.x + ny;
    });

    window.addEventListener("resize", () => {
      const w = this.container.clientWidth || 104;
      const h = this.container.clientHeight || 104;
      if (w > 0 && h > 0 && this.camera && this.renderer) {
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
      }
    });

    this.animate();
  }

  startCharging() {
    this.isCharging = true;
    this.chargeRatio = 0;
    this.container.classList.add("charging");
  }

  updateCharge(ratio) {
    this.chargeRatio = Math.min(ratio, 1.0);
  }

  stopCharging() {
    this.isCharging = false;
    this.chargeRatio = 0;
    this.container.classList.remove("charging");
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();

    if (this.isRolling) {
      // Exponential air friction decay
      this.spinVelocity.x *= 0.948;
      this.spinVelocity.y *= 0.948;
      this.spinVelocity.z *= 0.948;

      this.diceMesh.rotation.x += this.spinVelocity.x;
      this.diceMesh.rotation.y += this.spinVelocity.y;
      this.diceMesh.rotation.z += this.spinVelocity.z;

      // Table bounce simulation (parabolic arcs decaying over duration)
      const elapsed = now - this.rollStartTime;
      const progress = Math.min(1.0, elapsed / this.rollDuration);
      const bounceDecay = 1.0 - progress;
      const verticalHop = Math.abs(Math.sin(progress * Math.PI * 3.5)) * bounceDecay * 0.35 * this.currentPower;
      this.diceMesh.position.y = verticalHop;

      // Dynamic squish & stretch on impact
      const squish = 1.0 - Math.abs(Math.sin(progress * Math.PI * 3.5)) * 0.08 * bounceDecay;
      this.diceMesh.scale.set(1.0 + (1.0 - squish) * 0.5, squish, 1.0 + (1.0 - squish) * 0.5);

      if (elapsed >= this.rollDuration) {
        this.isRolling = false;
        this.isSettling = true;
        this.settleStartTime = now;
        this.diceMesh.position.y = 0;

        const rot = this.faceRotations[this.finalRollValue] || { x: 0, y: 0, z: 0 };
        const twoPi = Math.PI * 2;
        const targetX = Math.round(this.diceMesh.rotation.x / twoPi) * twoPi + rot.x;
        const targetY = Math.round(this.diceMesh.rotation.y / twoPi) * twoPi + rot.y;
        const targetZ = Math.round(this.diceMesh.rotation.z / twoPi) * twoPi + rot.z;

        this.targetRotation = { x: targetX, y: targetY, z: targetZ };
        this.settleStartRotation = {
          x: this.diceMesh.rotation.x,
          y: this.diceMesh.rotation.y,
          z: this.diceMesh.rotation.z
        };

        // Table contact impact thud
        if (window.sounds && typeof window.sounds.playTileLand === "function") {
          window.sounds.playTileLand(false);
        }
      }
    } else if (this.isSettling) {
      // Elastic spring settle into exact target pip angle
      const settleElapsed = (now - this.settleStartTime) / 160; // 160ms elastic settle
      if (settleElapsed < 1.0) {
        // Damped harmonic easing: 1 - e^(-4t) * cos(6t)
        const t = settleElapsed;
        const ease = 1 - Math.exp(-5 * t) * Math.cos(4 * Math.PI * t * 0.4);
        this.diceMesh.rotation.x = this.settleStartRotation.x + (this.targetRotation.x - this.settleStartRotation.x) * ease;
        this.diceMesh.rotation.y = this.settleStartRotation.y + (this.targetRotation.y - this.settleStartRotation.y) * ease;
        this.diceMesh.rotation.z = this.settleStartRotation.z + (this.targetRotation.z - this.settleStartRotation.z) * ease;

        const microSquish = 1.0 - Math.sin(t * Math.PI) * 0.05;
        this.diceMesh.scale.set(1.0 + (1.0 - microSquish) * 0.3, microSquish, 1.0 + (1.0 - microSquish) * 0.3);
      } else {
        this.isSettling = false;
        this.diceMesh.rotation.set(this.targetRotation.x, this.targetRotation.y, this.targetRotation.z);
        this.currentRotation = { ...this.targetRotation };
        this.diceMesh.scale.set(1, 1, 1);

        const cb = this.pendingCallback;
        this.pendingCallback = null;
        if (cb) cb(this.finalRollValue);
      }
    } else if (this.isCharging) {
      // Physical micro-tremble while charging
      const jitter = (Math.random() - 0.5) * (0.04 + this.chargeRatio * 0.08);
      this.diceMesh.rotation.x = this.targetRotation.x + jitter;
      this.diceMesh.rotation.y = this.targetRotation.y + jitter;
      const chargeLift = 1.0 + this.chargeRatio * 0.15;
      this.diceMesh.scale.set(chargeLift, chargeLift, chargeLift);
    } else {
      this.diceMesh.rotation.x += (this.targetRotation.x - this.diceMesh.rotation.x) * 0.22;
      this.diceMesh.rotation.y += (this.targetRotation.y - this.diceMesh.rotation.y) * 0.22;
      this.diceMesh.rotation.z += (this.targetRotation.z - this.diceMesh.rotation.z) * 0.22;
      this.diceMesh.scale.set(1, 1, 1);
    }

    this.renderer.render(this.scene, this.camera);
  }

  roll(finalValue, powerMultiplier = 1.0, callback) {
    if (this.pendingCallback) {
      const cb = this.pendingCallback;
      this.pendingCallback = null;
      cb();
    }

    this.stopCharging();
    this.isRolling = true;
    this.isSettling = false;
    this.pendingCallback = callback;
    this.finalRollValue = finalValue;
    if (this.btn) this.btn.disabled = true;

    const power = Math.max(0.8, Math.min(powerMultiplier, 2.2));
    this.currentPower = power;
    this.rollStartTime = performance.now();

    if (window.sounds) window.sounds.playDiceRoll(power);

    // Explosive launch angular velocity scaled to power
    const speedBase = 0.52 + power * 0.28;
    this.spinVelocity = {
      x: (speedBase + Math.random() * 0.18) * (Math.random() > 0.5 ? 1 : -1),
      y: (speedBase + Math.random() * 0.22) * (Math.random() > 0.5 ? 1 : -1),
      z: (speedBase * 0.85 + Math.random() * 0.15) * (Math.random() > 0.5 ? 1 : -1)
    };

    // Dynamic duration: snappy 380ms - 520ms
    this.rollDuration = Math.round(360 + power * 110);
  }

  showValue(val) {
    if (this.rollTimeout) {
      clearTimeout(this.rollTimeout);
      this.rollTimeout = null;
    }
    this.isRolling = false;
    this.stopCharging();
    const rot = this.faceRotations[val] || { x: 0, y: 0, z: 0 };
    this.targetRotation = { x: rot.x, y: rot.y, z: rot.z };
    this.currentRotation = { x: rot.x, y: rot.y, z: rot.z };
    this.diceMesh.rotation.set(rot.x, rot.y, rot.z);
    this.diceMesh.scale.set(1, 1, 1);
  }
}

window.ThreeDiceController = ThreeDiceController;
