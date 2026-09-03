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

    if (this.isRolling) {
      this.diceMesh.rotation.x += this.spinVelocity.x;
      this.diceMesh.rotation.y += this.spinVelocity.y;
      this.diceMesh.rotation.z += this.spinVelocity.z;

      this.bouncePhase += this.bounceSpeed;
      const bounceAmp = 0.12 * this.currentPower;
      const scale = 1.0 + Math.sin(this.bouncePhase) * bounceAmp;
      this.diceMesh.scale.set(scale, scale, scale);
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
    if (this.rollTimeout) {
      clearTimeout(this.rollTimeout);
      this.rollTimeout = null;
    }
    if (this.pendingCallback) {
      const cb = this.pendingCallback;
      this.pendingCallback = null;
      cb();
    }

    this.stopCharging();
    this.isRolling = true;
    this.pendingCallback = callback;
    if (this.btn) this.btn.disabled = true;

    const power = Math.max(0.8, Math.min(powerMultiplier, 2.2));
    this.currentPower = power;

    if (window.sounds) window.sounds.playDiceRoll(power);

    // Spin velocity scales with physical throw power
    const speedBase = 0.36 + power * 0.22;
    this.spinVelocity = {
      x: (speedBase + Math.random() * 0.15) * (Math.random() > 0.5 ? 1 : -1),
      y: (speedBase + Math.random() * 0.18) * (Math.random() > 0.5 ? 1 : -1),
      z: (speedBase * 0.8 + Math.random() * 0.12)
    };
    this.bouncePhase = 0;
    this.bounceSpeed = 0.22 + power * 0.08;

    // Dynamic duration: Quick flick = 400ms, Power throw = 700ms
    const rollDuration = Math.round(380 + power * 150);

    this.rollTimeout = setTimeout(() => {
      this.isRolling = false;
      this.rollTimeout = null;

      const rot = this.faceRotations[finalValue] || { x: 0, y: 0, z: 0 };
      const twoPi = Math.PI * 2;
      const targetX = Math.round(this.diceMesh.rotation.x / twoPi) * twoPi + rot.x;
      const targetY = Math.round(this.diceMesh.rotation.y / twoPi) * twoPi + rot.y;
      const targetZ = Math.round(this.diceMesh.rotation.z / twoPi) * twoPi + rot.z;

      this.targetRotation = { x: targetX, y: targetY, z: targetZ };
      this.currentRotation = { x: targetX, y: targetY, z: targetZ };

      const cb = this.pendingCallback;
      this.pendingCallback = null;
      if (cb) cb(finalValue);
    }, rollDuration);
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
