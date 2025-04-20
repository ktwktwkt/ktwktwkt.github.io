const Phaser = window.Phaser;
import ScenarioManager from '../managers/ScenarioManager.js';
import SpawnManager from '../managers/SpawnManager.js';
import UpgradeManager from '../managers/UpgradeManager.js';
import { weapons } from '../config/weapons.js';
import { enemies } from '../config/enemies.js';
import WeaponFactory from '../weapons/WeaponFactory.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }
  init(data) { 
    this.weaponType = data.weapon;
    this.gameOverTime = null;
  }
  preload() {
    // Load monster spritesheets based on frameSize defined in config
    const defaultTile = 64;
    Object.values(enemies).forEach(cfg => {
      const actions = cfg.actions;
      actions.forEach(action => {
        const key = `${cfg.key}_${action}`;
        const frameW = cfg.frameWidth || cfg.frameSize || defaultTile;
        const frameH = cfg.frameHeight || cfg.frameSize || defaultTile;
        this.load.spritesheet(
          key,
          `asset/characters/monsters/${key}.png`,
          { frameWidth: frameW, frameHeight: frameH }
        );
      });
    });
  }
  create() {
    // Setup monster animations (spritesheets loaded in preload)
    this.setupMonsterAnims();
    this.createTextures();
    this.initGroups();
    this.initPlayer();
    this.initUI();
    // 컨텍스트 메뉴 비활성화 + 커서 변경
    this.input.mouse.disableContextMenu();
    this.input.setDefaultCursor('crosshair');
    // 무기 및 탄약 설정
    this.weaponConfig = weapons[this.weaponType];
    this.ammo = this.weaponConfig.ammoCapacity;
    this.isReloading = false;
    this.lastFireTime = 0;
    this.ammoText = this.add.text(10,50,'Ammo:'+this.ammo+'/'+this.weaponConfig.ammoCapacity,{font:'16px Arial',fill:'#fff'}).setScrollFactor(0);
    this.uiElements.push(this.ammoText);
    this.reloadText = this.add.text(10,70,'',{font:'16px Arial',fill:'#ff0'}).setScrollFactor(0);
    this.uiElements.push(this.reloadText);
    // 적 설정
    this.enemyConfigs = enemies;
    this.bossSpawned = false;
    this.specialCooldown = 0;
    // mortar aiming indicator
    this.mortarReady = false;
    this.mortarAimPos = null;
    this.mortarIndicator = null;
    // Managers 초기화
    this.scenarioManager = new ScenarioManager(this);
    this.spawnManager = new SpawnManager(this);
    this.upgradeManager = new UpgradeManager(this);
    this.upgradeManager.text.setScrollFactor(0);
    this.initInput();
    // 초기 포인터 상태 리셋 (무기 선택 클릭 초기 발사 방지)
    this.input.activePointer.reset();
    this.initCollisions();
    // 배경색 설정 (짙은 회색톤)
    this.cameras.main.setBackgroundColor(0x1a1a2e);
    // 맵 크기 및 카메라 설정 (4배)
    const worldWidth = 3200 * 4, worldHeight = 2400 * 4;
    this.worldWidth=worldWidth; this.worldHeight=worldHeight;
    this.physics.world.setBounds(0,0,worldWidth,worldHeight);
    this.cameras.main.setBounds(0,0,worldWidth,worldHeight);
    // place player at center of world after bounds set
    this.player.setPosition(worldWidth/2, worldHeight/2);
    this.cameras.main.startFollow(this.player);
    // 발사체 최대 이동거리 (px)
    this.bulletRange = 1000;
    // 조준선 그래픽
    this.aimLine = this.add.graphics().setScrollFactor(0).setDepth(10);
    // 배경 장식물
    // 배경 장식물: 원활한 성능을 유지하며 개수 확장
    const decoCount = 1200;
    for (let i = 0; i < decoCount; i++) {
      const key = Phaser.Math.RND.pick(['grass','rock']);
      this.add.image(Phaser.Math.Between(0,this.worldWidth), Phaser.Math.Between(0,this.worldHeight), key).setDepth(-1);
    }
    // 적끼리 충돌 방지
    this.physics.add.collider(this.enemies, this.enemies);
    // 포탄 조준 위치 초기화
    this.chargePos = null;
    this.chainSpinStarted = false;
    this.chainSpinStartTime = 0;
    this.chargingCircle = null;
    // dash setup
    this.lastDashTime = 0;
    this.dashCooldown = 3000;
    this.dashDuration = 200;
    this.dashEndTime = 0;
    this.dashText = this.add.text(10,90,'Dash Ready',{font:'16px Arial',fill:'#0f0'}).setScrollFactor(0);
    this.uiElements.push(this.dashText);
    // chain gun spin-up and firing timers
    this.chainSpinTimer = null;
    this.chainFireTimer = null;
    // mortar prep flag and aim position
    // mortarReady, mortarAimPos, mortarIndicator
    // SMG auto-fire flag and timing
    this.smgAuto = false;
    this.lastSmgTime = 0;
    // enemy speed multiplier
    this.enemySpeedMultiplier = 1.3;
    // 무기 로직 객체 생성
    this.currentWeapon = WeaponFactory.create(this, this.weaponType);
    // staff charging circle
    this.chargingCircle = null;
    // configure UI camera: main camera ignores UI, UI camera ignores world
    this.uiElements.forEach(el => {
      el.setScrollFactor(0);
      this.cameras.main.ignore(el);
    });
    const { width, height } = this.scale;
    const uiCam = this.cameras.add(0, 0, width, height);
    uiCam.setZoom(1);
    // UI camera ignores non-UI objects
    this.children.list.forEach(child => {
      if (!this.uiElements.includes(child)) uiCam.ignore(child);
    });
  }

  update(time, delta) {
    if (this.gameOver) {
      if (this.gameOverTime===null) this.gameOverTime = time;
      // 3초 후 클릭 시 복귀
      if (time > this.gameOverTime + 3000 && this.input.activePointer.isDown) {
        this.scene.start('WeaponSelect');
      }
      return;
    }
    // 체력 재생
    if (this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + this.healthRegenRate * delta/1000);
    }
    this.scenarioManager.update(delta);
    if (!this.bossSpawned && this.scenarioManager.timeElapsed > 30) { this.spawnBoss(); this.bossSpawned = true; }
    if (this.scenarioManager.phase === 'combat') this.spawnManager.update(delta);
    // 대시 처리 (Shift)
    if (Phaser.Input.Keyboard.JustDown(this.shiftKey) && time > this.lastDashTime + this.dashCooldown) {
      this.lastDashTime = time;
      this.dashEndTime = time + this.dashDuration;
      let vel = this.player.body.velocity.clone();
      if (vel.length() === 0) vel.set(1,0);
      let dir = vel.normalize();
      this.player.setVelocity(dir.x * 600, dir.y * 600);
    }
    // 플레이어 이동 (대시 중 이동 제외)
    this.handlePlayerMovement();
    // 캐싱된 배열을 사용해 성능 최적화
    const enemiesArr = this.enemies.getChildren();
    const bulletsArr = this.bullets.getChildren();
    this.handleEnemies(delta, enemiesArr, bulletsArr);
    this.updateUI(delta);
    const ptr = this.input.activePointer;
    // 현재 무기 업데이트 (입력 처리 및 발사)
    this.currentWeapon.update(time, ptr);
    // dash UI
    if (time > this.lastDashTime + this.dashCooldown) {
      this.dashText.setText('Dash Ready').setFill('#0f0');
    } else {
      const left = ((this.lastDashTime + this.dashCooldown - time) / 1000).toFixed(1);
      this.dashText.setText('Dash: ' + left + 's').setFill('#f00');
    }
    // 조준선 그리기 (포인터 월드 좌표를 다시 스크린 좌표로 변환해, 줌에도 일관된 길이 유지)
    const cam = this.cameras.main;
    const sx = (this.player.x - cam.worldView.x) * cam.zoom;
    const sy = (this.player.y - cam.worldView.y) * cam.zoom;
    const worldPtr = cam.getWorldPoint(ptr.x, ptr.y);
    const px = (worldPtr.x - cam.worldView.x) * cam.zoom;
    const py = (worldPtr.y - cam.worldView.y) * cam.zoom;
    this.aimLine.clear();
    this.aimLine.lineStyle(2, 0xffffff, 0.7);
    this.aimLine.lineBetween(sx, sy, px, py);
    // 스태프 캐스팅 차징 원 표시
    if (this.isAiming && this.weaponType === 'staff' && this.chargePos) {
      const charge = Math.min((time - this.chargeStartTime) / (this.weaponConfig.chargeTime || 1000), 1);
      if (!this.chargingCircle) {
        this.chargingCircle = this.add.circle(this.chargePos.x, this.chargePos.y, 0, 0x00ffff, 0.3).setDepth(2);
      }
      this.chargingCircle.setPosition(this.chargePos.x, this.chargePos.y);
      this.chargingCircle.setRadius((this.weaponConfig.chargeRadius || 50) * charge);
    } else if (this.chargingCircle) {
      this.chargingCircle.destroy(); this.chargingCircle = null;
    }
    // 발사체 검토: 범위 및 미사일 호밍 (최대 100ms 단위)
    this.bullets.getChildren().forEach(b => {
      if(b.spawnX !== undefined && Phaser.Math.Distance.Between(b.spawnX, b.spawnY, b.x, b.y) > this.bulletRange) {
        // no emitter; nothing to destroy
        b.destroy(); return;
      }
      if (b.getData('type') === 'missile' && b.target) {
        if (!b._lastHoming || time > b._lastHoming + 100) {
          b._lastHoming = time;
          if (b.target.active) {
            const desired = Phaser.Math.Angle.Between(b.x, b.y, b.target.x, b.target.y);
            const newAngle = Phaser.Math.Angle.RotateTo(b.rotation, desired, 0.02);
            b.rotation = newAngle;
            this.physics.velocityFromRotation(newAngle, this.weaponConfig.bulletSpeed * b.damage, b.body.velocity);
          }
        }
      }
      // special trails for missile/rocket
      if (['missile','rocket'].includes(b.getData('type'))) {
        const intervalSpec = 40;
        if (time > b.lastTrail + intervalSpec) {
          const color = b.getData('type')==='rocket' ? 0xffa500 : 0x999999;
          const trail = this.add.circle(b.x, b.y, 8, color, 0.4).setDepth(0);
          this.tweens.add({ targets: trail, alpha: 0, scale: { from:1, to:0 }, duration: 300, onComplete: () => trail.destroy() });
          b.lastTrail = time;
        }
      }
      // universal bullet trail for other bullets
      else if (b.active) {
        const intervalAll = 30;
        if (time > b.lastTrail + intervalAll) {
          const trail = this.add.circle(b.x, b.y, 2, 0xffffff, 0.3).setDepth(0);
          this.tweens.add({ targets: trail, alpha: 0, scale: { from:1, to:0 }, duration: 200, onComplete: () => trail.destroy() });
          b.lastTrail = time;
        }
      }
      // GRANADE explode on stop
      if (b.getData('type')==='grenade' && b.body.speed < 10) {
        this.explodeGrenade(b);
        return;
      }
      // mortar projectile follows pointer
      if (b.getData('type')==='mortarProjectile') {
        const wp = this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
        this.physics.moveTo(b, wp.x, wp.y, this.weaponConfig.bulletSpeed * 0.5);
        if (Phaser.Math.Distance.Between(b.x, b.y, wp.x, wp.y) < 16) {
          this.createExplosion(b.x,b.y);
          b.destroy();
        }
        return;
      }
    });
  }

  // Textures 생성
  createTextures() {
    const gfx = this.add.graphics();
    const createCircle = (name, size, color) => { gfx.fillStyle(color).fillCircle(size/2,size/2,size/2); gfx.generateTexture(name,size,size); gfx.clear(); };
    createCircle('player', 32, 0x00ff00);
    // 탄환 텍스처 자동 생성
    Object.keys(weapons).forEach((w,i) => {
      const color = Phaser.Display.Color.HSVToRGB(i/Object.keys(weapons).length,1,1).color;
      createCircle('bullet_'+w,16,color);
    });
    createCircle('special', 24, 0xff00ff);
    // 배경 장식물 텍스처
    createCircle('grass', 12, 0x00aa00);
    createCircle('rock', 10, 0x555555);
    // Enemy textures are provided by spritesheets; no placeholder needed
    // Log each enemy frameSize (height/4) to console for manual config
    Object.values(enemies).forEach(cfg => {
      const idleKey = `${cfg.key}_idle`;
      if (this.textures.exists(idleKey)) {
        const img = this.textures.get(idleKey).getSourceImage();
        console.log(`${cfg.key}: ${Math.floor(img.height / 4)}`);
      }
    });
  }

  // Group 초기화
  initGroups() {
    this.bullets = this.physics.add.group();
    this.enemies = this.physics.add.group();
  }

  // Player 초기화
  initPlayer() {
    this.player = this.physics.add.sprite(400, 300, 'player').setCollideWorldBounds(true);
  }

  // UI 초기화
  initUI() {
    this.uiElements = [];
    this.timeElapsed = 0; this.maxHealth = 5; this.health = this.maxHealth; this.healthRegenRate = 0.05; this.gameOver = false;
    this.timerText = this.add.text(10,10,'Time:0',{font:'16px Arial',fill:'#fff'}).setScrollFactor(0);
    this.uiElements.push(this.timerText);
    this.healthText = this.add.text(10,30,'HP:'+Math.floor(this.health),{font:'16px Arial',fill:'#fff'}).setScrollFactor(0);
    this.uiElements.push(this.healthText);
    this.phaseText = this.add.text(600,10,'Phase:Combat',{font:'16px Arial',fill:'#fff'}).setScrollFactor(0);
    this.uiElements.push(this.phaseText);
  }

  // 입력 이벤트
  initInput() {
    // keyboard input setup
    this.cursors = this.input.keyboard.addKeys('W,A,S,D');
    this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.isAiming = false;
    this.isScoped = false;
    this.isChainAimed = false;
    this.input.on('pointerdown', p => {
      // SMG handling: right enables auto, left triggers burst
      if (this.weaponType === 'smg') {
        if (p.rightButtonDown()) this.smgAuto = true;
        if (p.leftButtonDown()) this.smgBurst(p);
        return;
      }
      // mortar: right-click prep at world pos with indicator
      if (p.rightButtonDown() && this.weaponType === 'mortar') {
        this.mortarReady = true;
        this.mortarAimPos = { x: p.worldX, y: p.worldY };
        if (this.mortarIndicator) this.mortarIndicator.destroy();
        this.mortarIndicator = this.add.circle(p.worldX, p.worldY, this.weaponConfig.explosionRadius||80, 0xff0000, 0.3);
        return;
      }
      // staff/magic/railgun/grenade charging
      if (p.leftButtonDown() && ['bow','railgun','staff','magic_staff','grenade'].includes(this.weaponType)) {
        this.isAiming = true;
        this.chargeStartTime = this.time.now;
        this.chargePos = { x: p.worldX, y: p.worldY };
      }
      // chain gun left-click spin-up
      else if (p.leftButtonDown() && this.weaponType === 'chain_gun') {
        if (this.chainSpinTimer) this.chainSpinTimer.remove();
        if (this.chainFireTimer) this.chainFireTimer.remove();
        this.chainSpinTimer = this.time.delayedCall(this.weaponConfig.spinUpTime || 1000, () => {
          this.chainFireTimer = this.time.addEvent({
            delay: this.weaponConfig.fireRate,
            callback: () => this.fireRegular(this.input.activePointer, 1),
            loop: true
          });
        });
        return;
      }
      // mortar fire when prepared, clear indicator
      else if (p.leftButtonDown() && this.weaponType === 'mortar' && this.mortarReady) {
        this.shoot('mortar', p, 1);
        this.mortarReady = false;
        this.mortarAimPos = null;
        if (this.mortarIndicator) { this.mortarIndicator.destroy(); this.mortarIndicator = null; }
        return;
      }
      // left-click fire for other weapons
      else if (p.leftButtonDown() && !this.isAiming) {
        this.shoot(this.weaponType, p, 1);
      }
      // right-click specials
      else if (p.rightButtonDown()) {
        if (this.weaponType === 'pistol') {
          for (let i = 0; i < 3; i++) this.time.delayedCall(i * 100, () => this.fireRegular(p, 1));
          return;
        }
        // rifle/sniper special zoom handled in pointer events
      }
      // sniper scope
      if (p.rightButtonDown() && this.weaponType === 'sniper') {
        this.isScoped = true;
        this.cameras.main.setZoom(0.5);
      }
      // rifle/smg: zoom in on right-button hold
      if (p.rightButtonDown() && ['smg','rifle'].includes(this.weaponType)) {
        this.cameras.main.setZoom(1.2);
      }
      // chain gun enter aim on right-down
      if (p.rightButtonDown() && this.weaponType==='chain_gun') {
        this.isChainAimed = true;
      }
    });
    this.input.on('pointerup', p => {
      // SMG stop auto on right release
      if (this.weaponType === 'smg' && p.rightButtonReleased()) this.smgAuto = false;
      if (this.isAiming) {
        const charge = Math.min((this.time.now - this.chargeStartTime)/(this.weaponConfig.chargeTime||1000),1);
        this.shoot(this.weaponType, p, charge);
        this.isAiming = false;
      }
      // clear chain gun timers on release
      if (this.weaponType === 'chain_gun') {
        if (this.chainSpinTimer) { this.chainSpinTimer.remove(); this.chainSpinTimer = null; }
        if (this.chainFireTimer) { this.chainFireTimer.remove(); this.chainFireTimer = null; }
      }
      // chain gun exit aim on right-release
      if (p.rightButtonReleased() && this.weaponType==='chain_gun') {
        this.isChainAimed = false;
      }
      // sniper unscope
      if (p.rightButtonReleased() && this.weaponType==='sniper') {
        this.isScoped = false;
        this.cameras.main.setZoom(1);
      }
      // rifle/smg reset zoom
      if (p.rightButtonReleased() && ['smg','rifle'].includes(this.weaponType)) this.cameras.main.setZoom(1);
      // mortar cancel prep
      if (p.rightButtonReleased() && this.weaponType==='mortar' && this.mortarReady) {
        this.mortarReady = false;
        this.mortarAimPos = null;
        if (this.mortarIndicator) { this.mortarIndicator.destroy(); this.mortarIndicator = null; }
      }
    });
    // sniper: zoom out on right-button hold, reset on release
    this.input.on('pointerdown', p => {
      if (p.rightButtonDown() && this.weaponType === 'sniper') {
        this.cameras.main.setZoom(0.5);
      }
      // rifle/smg: zoom in on right-button hold
      if (p.rightButtonDown() && ['smg','rifle'].includes(this.weaponType)) {
        this.cameras.main.setZoom(1.2);
      }
      // chain gun enter aim on right-down
      if (p.rightButtonDown() && this.weaponType==='chain_gun') {
        this.isChainAimed = true;
      }
    });
    this.input.on('pointerup', p => {
      if (p.rightButtonReleased() && ['sniper','smg','rifle'].includes(this.weaponType)) {
        this.cameras.main.setZoom(1);
      }
      // chain gun exit aim
      if (p.rightButtonReleased() && this.weaponType==='chain_gun') this.isChainAimed = false;
    });
  }

  // 충돌 처리
  initCollisions() {
    this.physics.add.overlap(this.bullets,this.enemies,this.bulletHit,null,this);
    this.physics.add.overlap(this.player,this.enemies,(p,e)=>{
      e.destroy();
      if (!this.gameOver) {
        this.health--;
        this.healthText.setText('HP:'+Math.floor(this.health));
        if (this.health <= 0) {
          this.gameOver = true;
          this.cameras.main.flash(500,255,0,0);
          const goText = this.add.text(400,300,'Game Over',{font:'32px Arial',fill:'#f00'}).setOrigin(0.5).setScrollFactor(0);
        }
      }
    });
  }

  // 플레이어 이동
  handlePlayerMovement() {
    // 대시 중 이동 처리 제외
    const time = this.time.now;
    if (time <= this.dashEndTime) return;
    // mortar prep: disable movement
    if (this.mortarReady) { this.player.setVelocity(0); return; }
    // 달리기 속도
    let baseSpeed = 200;
    // chain gun aiming halves speed
    if (this.isChainAimed) {
      baseSpeed = baseSpeed / 2;
    }
    // 충전 기능 무기: 이동속도 50%
    const chargingWeapons = ['staff','bow','railgun','magic_staff','grenade'];
    let speed = (this.isAiming && chargingWeapons.includes(this.weaponType)) ? baseSpeed/2 : baseSpeed;
    // 스코프 시 정지
    if (this.isScoped) { this.player.setVelocity(0); return; }
    let vx=0,vy=0;
    if(this.cursors.W.isDown) vy=-speed;
    if(this.cursors.S.isDown) vy=speed;
    if(this.cursors.A.isDown) vx=-speed;
    if(this.cursors.D.isDown) vx=speed;
    this.player.setVelocity(vx,vy);
  }

  // 적 이동/회피 및 관리
  handleEnemies(delta, enemiesArr, bulletsArr) {
    const time = this.time.now;
    enemiesArr.forEach(e => {
      if(e.dodge){
        let nearest = null, min = Infinity;
        bulletsArr.forEach(b => {
          const d = Phaser.Math.Distance.Between(e.x, e.y, b.x, b.y);
          if (d < min) { min = d; nearest = b; }
        });
        if(nearest && min<150){
          const vec = new Phaser.Math.Vector2(e.x-nearest.x,e.y-nearest.y).normalize().scale(e.speed * this.enemySpeedMultiplier);
          e.setVelocity(vec.x,vec.y);
          return;
        }
      }
      // movement based on pattern
      switch(e.movePattern) {
        case 'wander':
          // Random waypoint within world bounds
          if (!e.wanderTarget || Phaser.Math.Distance.Between(e.x,e.y,e.wanderTarget.x,e.wanderTarget.y) < 10) {
            e.wanderTarget = {
              x: Phaser.Math.Between(0,this.worldWidth),
              y: Phaser.Math.Between(0,this.worldHeight)
            };
          }
          this.physics.moveTo(e, e.wanderTarget.x, e.wanderTarget.y, e.speed*this.enemySpeedMultiplier);
          break;
        case 'circle':
          // Circle around player
          if (e.circleAngle === undefined) e.circleAngle = Phaser.Math.FloatBetween(0,Math.PI*2);
          e.circleAngle += delta * 0.002;
          const radius = 100 + (e.isBoss? 50:0);
          const px = this.player.x + Math.cos(e.circleAngle) * radius;
          const py = this.player.y + Math.sin(e.circleAngle) * radius;
          this.physics.moveTo(e, px, py, e.speed*this.enemySpeedMultiplier);
          break;
        case 'direct':
        default:
          // Move toward player
          this.physics.moveToObject(e, this.player, e.speed * this.enemySpeedMultiplier);
      }
      // 객체지향: HP 추적
      if(e.hp<=0){ e.destroy(); }
      else if(e.isBoss) {
        // update boss health bar
        e.healthBar.clear();
        const barWidth = 100, barHeight = 10;
        const x = e.x - barWidth / 2;
        const y = e.y - e.displayHeight / 2 - barHeight - 5;
        e.healthBar.fillStyle(0x0fff00).fillRect(x, y, barWidth * (e.hp / e.totalHp), barHeight);
      }
    });
  }

  updateUI(delta) {
    this.timeElapsed+=delta/1000; this.timerText.setText('Time:'+Math.floor(this.timeElapsed));
    this.healthText.setText('HP:'+Math.floor(this.health));
  }

  fireRegular(p, charge) {
    // staff / potion staff chain lightning
    if (['staff','potion_staff'].includes(this.weaponType)) { this.chainLightning(p, charge); return; }
    // grenade custom behavior
    if (this.weaponType === 'grenade') { this.fireGrenade(p, charge); return; }
    const now = this.time.now;
    if (this.isReloading || now < this.lastFireTime + this.weaponConfig.fireRate) return;
    this.lastFireTime = now;
    if (this.ammo <= 0) { this.startReload(); return; }
    // muzzle flash
    const flash = this.add.circle(this.player.x,this.player.y,20,0xffffff,1);
    this.tweens.add({targets:flash,radius:0,alpha:0,duration:100,onComplete:()=>flash.destroy()});
    const baseAngle = Phaser.Math.Angle.Between(this.player.x,this.player.y,p.worldX,p.worldY);
    for(let i=0;i<this.weaponConfig.bulletCount;i++){
      let angle = this.weaponConfig.bulletCount>1
        ? baseAngle + (i-(this.weaponConfig.bulletCount-1)/2)*(this.weaponConfig.spread||0)
        : baseAngle;
      // chain gun has lower accuracy spread
      if (this.weaponType==='chain_gun') {
        const spread = this.isChainAimed ? 0.1 : 0.2;
        angle += Phaser.Math.FloatBetween(-spread, spread);
      }
      // sniper accuracy: better when scoped
      if (this.weaponType === 'sniper') {
        if (!this.isScoped) angle += Phaser.Math.FloatBetween(-0.3, 0.3);
      }
      const key = 'bullet_'+this.weaponType;
      const b = this.bullets.create(this.player.x,this.player.y,key);
      b.rotation = angle;
      b.damage = this.weaponConfig.damage * (['bow','railgun'].includes(this.weaponType)? charge : 1);
      this.physics.velocityFromRotation(angle,this.weaponConfig.bulletSpeed,b.body.velocity);
      // 발사체 타입 및 스폰 위치 저장
      b.setData('type', this.weaponType);
      b.spawnX = this.player.x; b.spawnY = this.player.y;
      // initialize universal trail timer
      b.lastTrail = this.time.now;
      // lock missile to nearest enemy when fired
      if (this.weaponType === 'missile') {
        const enemiesArr = this.enemies.getChildren();
        if (enemiesArr.length > 0) {
          let nearest = enemiesArr[0];
          let minDist = Phaser.Math.Distance.Between(nearest.x, nearest.y, b.x, b.y);
          enemiesArr.forEach(e => {
            const d = Phaser.Math.Distance.Between(e.x, e.y, b.x, b.y);
            if (d < minDist) { minDist = d; nearest = e; }
          });
          b.target = nearest;
        }
      }
      // set bullet size per weapon config
      if (this.weaponConfig.bulletSize) b.setDisplaySize(this.weaponConfig.bulletSize, this.weaponConfig.bulletSize);
    }
    this.ammo--; this.ammoText.setText('Ammo:'+this.ammo+'/'+this.weaponConfig.ammoCapacity);
  }

  shoot(type,p,charge=1) {
    // 재장전 중 발사 방지
    if (this.isReloading) return;
    // 특별 무기 동작
    switch(this.weaponType) {
      case 'staff':
        // staff original explosion
        if (charge < 1) return;
        if (this.chargePos) {
          this.createExplosion(this.chargePos.x, this.chargePos.y);
          this.chargePos = null;
        }
        return;
      case 'potion_staff':
        // chain lightning for potion_staff
        this.chainLightning(p, charge);
        return;
      case 'magic_staff':
        // magic_staff immediate explosion at player
        this.createExplosion(this.player.x, this.player.y);
        return;
      case 'mortar':
        // mortar: spawn projectile that homing to pointer
        const wp = this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
        const m = this.bullets.create(this.player.x, this.player.y, 'bullet_mortar').setDepth(1).setAlpha(0.6);
        m.setData('type','mortarProjectile');
        m.targetPos = wp;
        this.physics.velocityFromRotation(Phaser.Math.Angle.Between(this.player.x,this.player.y,wp.x,wp.y), this.weaponConfig.bulletSpeed * 0.5, m.body.velocity);
        if (this.mortarIndicator) { this.mortarIndicator.destroy(); this.mortarIndicator = null; }
        this.mortarReady = false;
        this.ammo--; this.ammoText.setText('Ammo:'+this.ammo+'/'+this.weaponConfig.ammoCapacity);
        if (this.ammo <= 0) this.startReload();
        return;
      case 'grenade':
        // thrown grenade with drag
        this.fireGrenade(p, charge);
        return;
      default:
        this.fireRegular(p, charge);
    }
  }

  spawnBoss(){
    const cfg = enemies.boss;
    // Determine frame dimensions from config
    const baseW = cfg.frameWidth || cfg.frameSize;
    const baseH = cfg.frameHeight || cfg.frameSize;
    const frameW = baseW * (cfg.scale || 1);
    const frameH = baseH * (cfg.scale || 1);
    const cam = this.cameras.main;
    const cx = this.player.x, cy = this.player.y;
    const halfW = cam.width / 2 + frameW / 2;
    const halfH = cam.height / 2 + frameH / 2;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    let x = cx + Math.cos(angle) * halfW;
    let y = cy + Math.sin(angle) * halfH;
    x = Phaser.Math.Clamp(x, 0, this.worldWidth);
    y = Phaser.Math.Clamp(y, 0, this.worldHeight);
    const e = this.enemies.create(x, y, `${cfg.key}_idle`, 0);
    // Set enemy size
    this.applyEnemySize(e, cfg);
    e.speed=cfg.speed; e.hp=cfg.hp; e.totalHp=cfg.hp; e.isBoss=true;
    e.setDepth(1);
    // initialize boss health bar
    e.healthBar = this.add.graphics().setDepth(2);
    // 소환 연출
    this.cameras.main.shake(500,0.02);
    // 소환 연출 파티클 (Phaser v3.60)
    this.add.particles({
      key: 'special', x: x, y: y,
      speed: { min: -200, max: 200 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 500,
      quantity: 50
    });
    // Boss moves directly toward player
    e.movePattern = 'direct';
  }

  // 일반 적 스폰 메서드
  spawnEnemy() {
    // choose random enemy config
    const types = Object.keys(enemies).filter(t => t !== 'boss');
    const type = Phaser.Math.RND.pick(types);
    const cfg = enemies[type];
    // Determine frame dimensions from config
    const baseW = cfg.frameWidth || cfg.frameSize;
    const baseH = cfg.frameHeight || cfg.frameSize;
    // 플레이어 주변 화면 바깥에서 스폰
    const cam = this.cameras.main;
    const cx = this.player.x, cy = this.player.y;
    const halfWEnv = cam.width / 2;
    const halfHEnv = cam.height / 2;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    // Spawn outside camera view with extra distance for sniping
    const spawnRadiusX = halfWEnv * 1.5 + baseW / 2;
    const spawnRadiusY = halfHEnv * 1.5 + baseH / 2;
    let x = cx + Math.cos(angle) * spawnRadiusX;
    let y = cy + Math.sin(angle) * spawnRadiusY;
    const e = this.enemies.create(x, y, `${cfg.key}_idle`, 0);
    // Set enemy size
    this.applyEnemySize(e, cfg);
    // play movement animation (walk or idle)
    const walkAnim = cfg.key + '_walk_anim';
    if (this.anims.exists(walkAnim)) {
      e.play(walkAnim);
    } else {
      e.play(cfg.key + '_idle_anim');
    }
    e.speed = cfg.speed;
    e.hp = cfg.hp; e.totalHp = cfg.hp;
    e.isBoss = false;
    e.dodge = cfg.dodge || false;
    // Assign movement pattern: direct, wander, or circle
    e.movePattern = Phaser.Math.RND.pick(['direct','wander','circle']);
    return e;
  }

  // Helper to set display and body size based on frameSize and scale
  applyEnemySize(sprite, cfg) {
    // Use config dimensions if provided (rectangular), otherwise from texture frame
    const frameWidth = cfg.frameWidth || sprite.frame.width;
    const frameHeight = cfg.frameHeight || sprite.frame.height;
    const scale = cfg.scale || 1;
    sprite.setDisplaySize(frameWidth * scale, frameHeight * scale);
    sprite.body.setSize(frameWidth * scale, frameHeight * scale);
  }

  // 탄환과 적의 충돌 처리
  bulletHit(bullet, enemy) {
    // 로켓 폭발 처리
    if (bullet.getData('type') === 'rocket') {
      const radius = 100;
      this.enemies.getChildren().forEach((e) => {
        const d = Phaser.Math.Distance.Between(bullet.x, bullet.y, e.x, e.y);
        if (d <= radius) {
          e.hp -= bullet.damage;
          if (e.hp <= 0) {
            if (e.isBoss) e.healthBar.destroy();
            e.destroy();
            this.upgradeManager.onKill();
          }
        }
      });
      bullet.destroy();
      return;
    }
    // 일반 탄환 처리
    enemy.hp -= bullet.damage;
    // 피격 시 tint flash
    enemy.setTint(0xff0000);
    this.time.delayedCall(100, () => enemy.clearTint());
    bullet.destroy();
    if (enemy.hp <= 0) {
      if (enemy.isBoss) enemy.healthBar.destroy();
      enemy.destroy();
      this.upgradeManager.onKill();
    }
  }

  createExplosion(x, y) {
    const radius = this.weaponConfig.explosionRadius || 80;
    // 폭발 효과 강화
    const explosionCircle = this.add.circle(x, y, radius, 0xffaa00, 0.5);
    this.tweens.add({ targets: explosionCircle, radius: radius * 2, alpha: 0, duration: 300, onComplete: () => explosionCircle.destroy() });
    // 폭발 피해 적용
    this.enemies.getChildren().forEach(e => {
      if (Phaser.Math.Distance.Between(x, y, e.x, e.y) <= radius) {
        e.hp -= this.weaponConfig.damage;
        if (e.hp <= 0) {
          if (e.isBoss) e.healthBar.destroy();
          e.destroy(); this.upgradeManager.onKill();
        }
      }
    });
  }

  chainBurst(p) {
    const now = this.time.now;
    // cooldown
    if (now < this.specialCooldown) return;
    // require spin-up completed
    if (this.chainSpinStartTime === 0 || now < this.chainSpinStartTime + (this.weaponConfig.spinUpTime||500)) return;
    // burst fire (5발)
    const burstCount = 5;
    for (let i = 0; i < burstCount; i++) {
      this.time.delayedCall(i * this.weaponConfig.fireRate, () => this.fireRegular(p, 1));
    }
    // apply ammo and start reload if needed
    this.ammo -= burstCount;
    this.ammoText.setText('Ammo:' + this.ammo + '/' + this.weaponConfig.ammoCapacity);
    if (this.ammo <= 0) this.startReload();
    // set next special cooldown
    this.specialCooldown = now + this.weaponConfig.reloadTime;
    // reset spin-up
    this.chainSpinStartTime = 0;
  }

  startReload() {
    if (this.isReloading) return;
    this.isReloading = true;
    this.reloadText.setText('Reloading...');
    this.time.delayedCall(this.weaponConfig.reloadTime, () => {
      this.ammo = this.weaponConfig.ammoCapacity;
      this.ammoText.setText('Ammo:'+this.ammo+'/'+this.weaponConfig.ammoCapacity);
      this.reloadText.setText('');
      this.isReloading = false;
    });
  }

  // SMG 3-round burst
  smgBurst(p) {
    if (this.isReloading) return;
    let burstCount = 3;
    if (this.ammo < burstCount) burstCount = this.ammo;
    for (let i = 0; i < burstCount; i++) {
      this.time.delayedCall(i * this.weaponConfig.fireRate, () => this.fireRegular(p, 1));
    }
    this.ammo -= burstCount;
    this.ammoText.setText('Ammo:' + this.ammo + '/' + this.weaponConfig.ammoCapacity);
    if (this.ammo <= 0) this.startReload();
  }

  // staff chain lightning implementation
  chainLightning(p, charge) {
    const arr = this.enemies.getChildren();
    arr.sort((a,b)=>Phaser.Math.Distance.Between(this.player.x,this.player.y,a.x,a.y) - Phaser.Math.Distance.Between(this.player.x,this.player.y,b.x,b.y));
    const hits = arr.slice(0,3);
    hits.forEach(e=>{
      const line = this.add.graphics().lineStyle(2,0x00ffff).moveTo(this.player.x,this.player.y).lineTo(e.x,e.y).setDepth(1);
      this.time.delayedCall(100,()=>line.destroy());
      e.hp -= this.weaponConfig.damage * (charge||1);
      if (e.hp<=0) e.destroy();
    });
  }

  // grenade throw and explode
  fireGrenade(p, charge) {
    // fire grenade straight, then slow via drag
    const angle = Phaser.Math.Angle.Between(this.player.x,this.player.y,p.worldX,p.worldY);
    const g = this.bullets.create(this.player.x,this.player.y,'bullet_grenade').setDepth(1);
    g.setData('type','grenade');
    this.physics.velocityFromRotation(angle, this.weaponConfig.bulletSpeed, g.body.velocity);
    g.body.setDrag(this.weaponConfig.bulletSpeed * 0.5);
  }

  explodeGrenade(g) {
    if (!g.active) return;
    const r = this.weaponConfig.explosionRadius||80;
    const ex = this.add.circle(g.x,g.y,r,0xff0000,0.3).setDepth(0);
    this.enemies.getChildren().forEach(e=>{
      if (Phaser.Math.Distance.Between(g.x,g.y,e.x,e.y)<=r) {
        e.hp -= this.weaponConfig.damage*2;
        if (e.hp<=0) e.destroy();
      }
    });
    this.time.delayedCall(200,()=>ex.destroy());
    g.destroy();
  }

  setupMonsterAnims() {
    Object.values(enemies).forEach(cfg => {
      const actions = cfg.actions;
      actions.forEach(action => {
        const key = `${cfg.key}_${action}`;
        if (!this.textures.exists(key)) return;
        const img = this.textures.get(key).getSourceImage();
        // Derive frameSize from image height (4 rows) and compute columns
        const rows = 4;
        const frameSize = img.height / rows;
        const cols = Math.floor(img.width / frameSize);
        const dirs = ['down','left','right','up'];
        const baseRate = action === 'idle' ? 4 : 8;
        const repeatOnce = ['attack','die','hit'].includes(action);
        // Create animations for each row
        for (let row = 0; row < rows; row++) {
          const dir = dirs[row] || `dir${row}`;
          const start = row * cols;
          const end = start + cols - 1;
          this.anims.create({ key: `${cfg.key}_${action}_${dir}_anim`, frames: this.anims.generateFrameNumbers(key, { start, end }), frameRate: action === 'attack' ? 12 : action === 'die' ? 6 : action === 'hit' ? 10 : baseRate, repeat: repeatOnce ? 0 : -1 });
        }
        // Alias for default direction (row 0)
        this.anims.create({ key: `${cfg.key}_${action}_anim`, frames: this.anims.generateFrameNumbers(key, { start: 0, end: cols - 1 }), frameRate: baseRate, repeat: repeatOnce ? 0 : -1 });
      });
    });
  }
}
