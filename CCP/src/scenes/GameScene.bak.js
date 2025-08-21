import Phaser from 'phaser';
import PixelPlayer from '../entities/PixelPlayer.js';
import PixelEnemy from '../entities/PixelEnemy.js';
import { WeaponType } from '../systems/WeaponData.js';
import MapGenerator from '../systems/MapGenerator.js';
import ParticleManager from '../systems/ParticleManager.js';
import CursorManager from '../utils/CursorManager.js';
import SoundManager from '../systems/SoundManager.js';
import UIManager from '../ui/UIManager.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.player = null;
        this.enemies = null;
        this.bullets = null;
        this.cursors = null;
        this.wasd = null;
        
        // 게임 시간 및 웨이브
        this.gameTime = 0;
        this.waveNumber = 0;
        this.isEscapePhase = false;
        this.escapeBeacon = null;
        
        // 무기 선택 (모든 무기 사용 가능)
        this.availableWeapons = Object.values(WeaponType);
        this.currentWeaponIndex = 0;
    }

    create() {
        // 사운드 매니저 초기화
        this.soundManager = new SoundManager(this);
        
        // 물리 세계 설정 - 더 큰 맵
        this.physics.world.setBounds(0, 0, 1920, 1280);
        
        // 카메라 설정
        this.cameras.main.setBounds(0, 0, 1920, 1280);
        this.cameras.main.setZoom(1.5);
        
        // 픽셀아트 렌더링 설정
        this.cameras.main.roundPixels = true;
        this.game.renderer.pixelArt = true;
        
        // 맵 생성
        this.mapGenerator = new MapGenerator(this);
        this.mapGenerator.generateMap();
        
        // 파티클 매니저
        this.particleManager = new ParticleManager(this);
        
        // 커서 매니저
        this.cursorManager = new CursorManager(this);
        
        this.createPlayer();
        this.createEnemies();
        this.setupCollisions();
        this.setupInput();
        this.createUI();
        
        // UI 매니저 초기화 (createUI 후에)
        this.uiManager = new UIManager(this);
        
        this.setupEventListeners();
        this.createLighting();
        
        // 아이템 시스템
        this.droppedItems = [];
        this.setupItemPickup();
        
        // 웨이브 시스템 초기화
        this.waveNumber = 0;
        this.lastWaveSpawnTime = 0;
        this.waveSpawnInterval = 15000; // 15초마다 새 웨이브
    }

    createLighting() {
        // 비네팅 효과로 어두운 분위기 연출
        this.vignette = this.add.rectangle(960, 640, 1920, 1280, 0x000000, 0);
        this.vignette.setScrollFactor(0);
        this.vignette.setDepth(1000);
        
        // 비네팅 그라디언트 효과
        const graphics = this.add.graphics();
        graphics.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.4, 0, 0.4);
        graphics.fillRect(0, 0, 1280, 720);
        graphics.setScrollFactor(0);
        graphics.setDepth(999);
        graphics.setAlpha(0.3);
    }

    createPlayer() {
        const spawn = this.mapGenerator.getRandomSpawnPoint();
        this.player = new PixelPlayer(this, spawn.x, spawn.y);
        
        // 카메라 팔로우
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        
        this.bullets = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite,
            maxSize: 100,
            runChildUpdate: true
        });
        
        // 대시 기능 (Shift키)
        this.input.keyboard.on('keydown-SHIFT', () => {
            this.player.dash();
        });
    }

    createEnemies() {
        this.enemies = this.physics.add.group();
        
        // 초기 적 생성 (수 증가)
        const initialEnemyCount = 12; // 5에서 12로 증가
        const enemyTypes = ['normal', 'fast', 'ranged', 'tank', 'zigzag', 'circler', 'charger', 'sniper']; // 새로운 패턴 추가
        
        for (let i = 0; i < initialEnemyCount; i++) {
            const spawn = this.mapGenerator.getRandomSpawnPoint();
            if (Phaser.Math.Distance.Between(spawn.x, spawn.y, this.player.x, this.player.y) > 300) {
                const type = Phaser.Math.RND.pick(enemyTypes);
                const enemy = new PixelEnemy(this, spawn.x, spawn.y, type);
                this.enemies.add(enemy);
            }
        }
    }

    setupCollisions() {
        // 벽과의 충돌
        this.physics.add.collider(this.player, this.mapGenerator.getWallGroup());
        this.physics.add.collider(this.enemies, this.mapGenerator.getWallGroup());
        this.physics.add.collider(this.bullets, this.mapGenerator.getWallGroup(), (bullet, wall) => {
            this.createBulletImpact(bullet.x, bullet.y);
            bullet.destroy();
        });
        
        // 기존 충돌
        this.physics.add.collider(this.player, this.enemies, this.handlePlayerEnemyCollision, null, this);
        this.physics.add.collider(this.bullets, this.enemies, this.handleBulletEnemyCollision, null, this);
        this.physics.add.collider(this.enemies, this.enemies);
    }

    setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D,R,Q,E');
        
        // 마우스 입력 처리
        this.input.on('pointerdown', (pointer) => {
            if (pointer.leftButtonDown()) {
                this.player.startShooting();
                this.continuousShooting = true;
            }
        });
        
        this.input.on('pointerup', () => {
            this.player.stopShooting();
            this.continuousShooting = false;
        });
        
        // R키로 재장전
        this.wasd.R.on('down', () => {
            this.player.reload();
            if (this.player.currentWeapon && !this.player.currentWeapon.stats.manaRegen) {
                this.cursorManager.showReloadGauge(this.player.currentWeapon.stats.reloadTime);
            }
        });
        
        // Q, E로 무기 전환
        this.wasd.Q.on('down', () => {
            this.switchToPreviousWeapon();
        });
        
        this.wasd.E.on('down', () => {
            this.switchToNextWeapon();
        });
    }

    createUI() {
        // UIManager가 모든 UI를 처리함 - 기존 UI 요소들은 생성하지 않음
        
        // 탈출 알림 (초기엔 숨김)
        this.escapeText = this.add.text(640, 300, 'ESCAPE BEACON READY!\nPress SPACE to activate', {
            fontSize: '32px',
            color: '#00ff00',
            align: 'center',
            fontStyle: 'bold',
            fontFamily: 'monospace'
        }).setOrigin(0.5).setVisible(false);
        this.escapeText.setScrollFactor(0);
        this.escapeText.setDepth(200);
    }

    handlePlayerEnemyCollision(player, enemy) {
        // PixelEnemy가 자체적으로 공격을 처리하므로
        // 여기서는 기본 충돌 데미지만 처리
        // (이미 enemy.update에서 근접 공격 처리됨)
    }

    handleBulletEnemyCollision(bullet, enemy) {
        // 히트 이펙트
        this.createHitEffect(enemy.x, enemy.y);
        
        // 크리티컬 체크 및 이펙트 (피격 시점에 표시)
        if (bullet.isCritical) {
            this.showCriticalEffect(enemy.x, enemy.y);
        }
        
        // 관통 처리
        if (bullet.penetration > bullet.penetrationCount) {
            bullet.penetrationCount++;
        } else {
            this.createBulletImpact(bullet.x, bullet.y);
            bullet.destroy();
        }
        
        // 데미지 적용
        enemy.takeDamage(bullet.damage || 25);
        
        // 폭발성 무기 처리
        if (bullet.explosive) {
            this.createExplosionEffect(bullet.x, bullet.y);
            this.handleExplosion(bullet.x, bullet.y, bullet.damage, bullet.explosionRadius);
            bullet.destroy();
        }
        
        // 적 사망 시 처리 (PixelEnemy의 die()가 자동으로 처리함)
        // 점수는 적이 실제로 죽었을 때 추가
    }

    gameOver() {
        this.physics.pause();
        
        const gameOverText = this.add.text(640, 300, 'GAME OVER', {
            fontSize: '64px',
            color: '#ff0000',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0); // 화면에 고정
        gameOverText.setDepth(200);
        
        const restartText = this.add.text(640, 400, 'Click to restart', {
            fontSize: '32px',
            color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0); // 화면에 고정
        restartText.setDepth(200);
        
        this.input.once('pointerdown', () => {
            this.scene.restart();
        });
    }

    update(time, delta) {
        if (this.player && this.player.active) {
            this.player.update(this.cursors, this.wasd, this.input.activePointer);
            
            // 주기적 웨이브 스폰
            if (time - this.lastWaveSpawnTime > this.waveSpawnInterval) {
                this.waveNumber++;
                this.spawnWaveEnemies();
                this.lastWaveSpawnTime = time;
                
                // 웨이브 알림
                this.showWaveText(`Wave ${this.waveNumber}`);
            }
            
            // 연속 사격
            if (this.continuousShooting) {
                const pointer = this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
                this.player.shoot(this.bullets, pointer.x, pointer.y);
            }
            
            this.enemies.children.entries.forEach(enemy => {
                if (enemy.active) {
                    enemy.update(this.player);
                }
            });
            
            // 총알 효과 업데이트
            this.updateBulletEffects();
            
            // 커서 차징 표시
            if (this.player.currentWeapon && this.player.currentWeapon.isCharging) {
                this.cursorManager.updateChargeLevel(this.player.currentWeapon.chargeLevel);
            } else {
                this.cursorManager.updateChargeLevel(0);
            }
            
            // 게임 시간 업데이트
            this.updateGameTime(delta);
            
            // UI 업데이트
            this.updateUI();
        }
    }
    
    updateGameTime(delta) {
        this.gameTime += delta;
        
        const seconds = Math.floor(this.gameTime / 1000);
        const minutes = Math.floor(seconds / 60);
        const displaySeconds = seconds % 60;
        
        // 10분 후 탈출 페이즈
        if (!this.isEscapePhase && this.gameTime >= 600000) {
            this.startEscapePhase();
        }
        
        // 30초마다 웨이브 증가
        const newWave = Math.floor(seconds / 30) + 1;
        if (newWave !== this.waveNumber) {
            this.waveNumber = newWave;
            this.spawnWaveEnemies();
        }
    }
    
    updateUI() {
        // UIManager로 UI 업데이트 - 안전성 체크 추가
        if (this.player && this.player.active && this.uiManager) {
            const health = typeof this.player.health === 'number' ? this.player.health : 0;
            const maxHealth = typeof this.player.maxHealth === 'number' ? this.player.maxHealth : 100;
            const score = typeof this.player.score === 'number' ? this.player.score : 0;
            
            this.uiManager.updateHealth(health, maxHealth);
            this.uiManager.updateScore(score);
            
            if (this.player.currentWeapon) {
                this.uiManager.updateWeaponInfo(this.player.currentWeapon);
            }
            
            if (this.enemies) {
                this.uiManager.updateMinimap(this.player, this.enemies);
            }
        }
        
        if (this.uiManager) {
            this.uiManager.updateTimer(this.gameTime / 1000);
            this.uiManager.updateWave(this.waveNumber);
        }
        
        // 보스 체력바 업데이트
        if (this.enemies && this.enemies.children && this.uiManager) {
            const boss = this.enemies.children.entries.find(e => e && e.type === 'boss' && e.active);
            if (boss) {
                this.uiManager.showBossHealth(boss);
                this.uiManager.updateBossHealth(boss.health, boss.maxHealth);
            } else {
                this.uiManager.hideBossHealth();
            }
        }
        
    }
    
    startEscapePhase() {
        this.isEscapePhase = true;
        this.escapeText.setVisible(true);
        
        // 맵에 탈출 지점 표시
        if (this.mapGenerator) {
            this.mapGenerator.showEscapeZone();
        }
        
        // 스페이스바로 탈출 비컨 활성화
        this.input.keyboard.once('keydown-SPACE', () => {
            this.activateEscapeBeacon();
        });
    }
    
    activateEscapeBeacon() {
        this.escapeText.setText('ESCAPING IN 5:00\nSURVIVE!');
        // 5분 타이머 시작
        this.time.delayedCall(300000, () => {
            this.escapeSuccess();
        });
    }
    
    escapeSuccess() {
        this.physics.pause();
        this.add.text(640, 360, 'ESCAPE SUCCESSFUL!', {
            fontSize: '64px',
            color: '#00ff00',
            fontStyle: 'bold'
        }).setOrigin(0.5);
    }
    
    spawnWaveEnemies() {
        const enemyCount = Math.min(8 + this.waveNumber * 3, 40); // 수 대폭 증가
        const types = ['normal', 'fast', 'ranged', 'tank', 'zigzag', 'circler', 'charger', 'sniper'];
        
        // 30초마다 보스 스폰
        if (this.waveNumber % 2 === 0 && this.waveNumber > 0) {
            const spawn = this.mapGenerator.getRandomSpawnPoint();
            const boss = new PixelEnemy(this, spawn.x, spawn.y, 'boss');
            this.enemies.add(boss);
            
            // 보스 경고
            const warningText = this.add.text(640, 200, 'BOSS INCOMING!', {
                fontSize: '48px',
                color: '#ff0000',
                fontFamily: 'monospace',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            warningText.setScrollFactor(0);
            warningText.setDepth(200);
            
            this.tweens.add({
                targets: warningText,
                alpha: 0,
                scale: 2,
                duration: 2000,
                onComplete: () => warningText.destroy()
            });
        }
        
        // 일반 적 스폰
        for (let i = 0; i < enemyCount; i++) {
            const angle = (Math.PI * 2 / enemyCount) * i;
            const distance = 400 + Phaser.Math.Between(0, 200);
            
            const x = this.player.x + Math.cos(angle) * distance;
            const y = this.player.y + Math.sin(angle) * distance;
            
            if (x > 50 && x < 1870 && y > 50 && y < 1230) {
                const type = Phaser.Math.RND.pick(types);
                const enemy = new PixelEnemy(this, x, y, type);
                
                // 웨이브에 따른 강화
                enemy.health *= (1 + this.waveNumber * 0.15);
                enemy.damage *= (1 + this.waveNumber * 0.1);
                
                this.enemies.add(enemy);
            }
        }
    }
    
    switchToNextWeapon() {
        this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.availableWeapons.length;
        this.player.switchWeapon(this.availableWeapons[this.currentWeaponIndex]);
        this.cursorManager.setCursorForWeapon(this.availableWeapons[this.currentWeaponIndex]);
        this.showWeaponSwitchText();
    }
    
    updateBulletEffects() {
        // 총알 트레일 효과
        this.bullets.children.entries.forEach(bullet => {
            if (bullet.active && bullet.weaponType === 'railgun') {
                // 레일건 트레일
                if (!bullet.trail) {
                    bullet.trail = this.add.rectangle(bullet.x, bullet.y, 30, 2, 0x00ffff, 0.5);
                    bullet.trail.setDepth(12);
                }
                bullet.trail.x = bullet.x - bullet.body.velocity.x * 0.02;
                bullet.trail.y = bullet.y - bullet.body.velocity.y * 0.02;
                bullet.trail.rotation = Math.atan2(bullet.body.velocity.y, bullet.body.velocity.x);
            }
        });
    }
    
    createHitEffect(x, y) {
        if (this.particleManager) {
            this.particleManager.createHitEffect(x, y);
        }
    }
    
    createBulletImpact(x, y) {
        if (this.particleManager) {
            this.particleManager.createBulletImpact(x, y);
        }
    }
    
    createExplosionEffect(x, y) {
        if (this.particleManager) {
            this.particleManager.createExplosion(x, y);
        }
    }
    
    createDeathEffect(x, y) {
        if (this.particleManager) {
            this.particleManager.createDeathEffect(x, y);
        }
    }
    
    showCriticalEffect(x, y) {
        // 크리티컬 텍스트 (강도 줄임)
        const critText = this.add.text(x, y - 30, 'CRITICAL!', {
            fontSize: '24px',
            color: '#ffff00',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#ff0000',
            strokeThickness: 2
        }).setOrigin(0.5);
        critText.setDepth(100);
        
        // 약한 화면 흔들림 (강도 줄임)
        this.cameras.main.shake(100, 0.003);
        
        // 옅은 노란색 플래시 오버레이 생성
        const flashOverlay = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width,
            this.cameras.main.height,
            0xffff88,
            0.08  // 8% 투명도로 매우 옅게
        flashOverlay.setScrollFactor(0);
        flashOverlay.setDepth(999);
        
        // 페이드 아웃 효과
        this.tweens.add({
            targets: flashOverlay,
            alpha: 0,
            duration: 150,
            ease: 'Power2',
            onComplete: () => flashOverlay.destroy()
        });
        
        // 텍스트 애니메이션
        this.tweens.add({
            targets: critText,
            y: critText.y - 20,
            scale: 1.3,
            alpha: 0,
            duration: 600,
            ease: 'Power2',
            onComplete: () => critText.destroy()
        });
        
        // 크리티컬 파티클 이펙트 (강도 줄임)
        if (this.particleManager) {
            // 기존 히트 이펙트보다 약간 강한 정도로만
            for (let i = 0; i < 10; i++) {
                const particle = this.add.graphics();
                particle.fillStyle(0xffff00, 0.8);
                particle.fillRect(-2, -2, 4, 4);
                particle.x = x;
                particle.y = y;
                
                const angle = (Math.PI * 2 / 10) * i;
                const speed = 150;
                
                this.tweens.add({
                    targets: particle,
                    x: x + Math.cos(angle) * 40,
                    y: y + Math.sin(angle) * 40,
                    alpha: 0,
                    duration: 400,
                    ease: 'Power2',
                    onComplete: () => particle.destroy()
                });
            }
        }
    }
    
    setupItemPickup() {
        // 아이템 픽업 체크 (매 프레임)
        this.time.addEvent({
            delay: 100,
            callback: () => {
                if (!this.player || !this.player.active) return;
                
                this.droppedItems = this.droppedItems.filter(item => {
                    if (!item || !item.active) return false;
                    
                    const distance = Phaser.Math.Distance.Between(
                        this.player.x, this.player.y,
                        item.x, item.y
                    );
                    
                    if (distance < 30) {
                        // 아이템 획득
                        this.pickupItem(item.itemType);
                        
                        // 획득 이펙트
                        this.tweens.add({
                            targets: item,
                            y: item.y - 30,
                            alpha: 0,
                            scale: 2,
                            duration: 300,
                            onComplete: () => item.destroy()
                        });
                        
                        return false;
                    }
                    return true;
                });
            },
            loop: true
        });
    }
    
    pickupItem(itemType) {
        switch(itemType) {
            case 'health':
                this.player.heal(25);
                // 체력 UI는 UIManager가 처리
                if (this.uiManager) {
                    this.uiManager.updateHealth(this.player.health, this.player.maxHealth);
                }
                this.showPickupText('+25 HP', 0x00ff00);
                break;
                
            case 'ammo':
                if (this.player.currentWeapon) {
                    this.player.currentWeapon.currentAmmo = this.player.currentWeapon.stats.magazineSize;
                    this.showPickupText('AMMO FULL', 0xffff00);
                }
                break;
                
            case 'powerup':
                if (this.player.currentWeapon) {
                    this.player.currentWeapon.upgrade();
                    this.showPickupText('WEAPON UPGRADE!', 0x00ffff);
                }
                break;
        }
    }
    
    showPickupText(text, color) {
        const pickupText = this.add.text(
            this.player.x,
            this.player.y - 40,
            text,
            {
                fontSize: '20px',
                color: '#' + color.toString(16).padStart(6, '0'),
                fontFamily: 'monospace',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        pickupText.setDepth(100);
        pickupText.setScrollFactor(0); // 화면에 고정
        
        // 화면 좌표로 변환
        const screenPos = this.cameras.main.getWorldPoint(this.player.x, this.player.y - 40);
        pickupText.setPosition(screenPos.x, screenPos.y);
        
        this.tweens.add({
            targets: pickupText,
            y: pickupText.y - 40,
            alpha: 0,
            duration: 1000,
            onComplete: () => pickupText.destroy()
        });
    }
    
    switchToPreviousWeapon() {
        this.currentWeaponIndex = (this.currentWeaponIndex - 1 + this.availableWeapons.length) % this.availableWeapons.length;
        this.player.switchWeapon(this.availableWeapons[this.currentWeaponIndex]);
        this.cursorManager.setCursorForWeapon(this.availableWeapons[this.currentWeaponIndex]);
        this.showWeaponSwitchText();
    }
    
    showWeaponSwitchText() {
        const weaponName = this.player.currentWeapon.stats.name;
        const switchText = this.add.text(640, 400, weaponName, {
            fontSize: '32px',
            color: '#ffff00',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0); // 화면에 고정
        switchText.setDepth(100);
        
        this.tweens.add({
            targets: switchText,
            alpha: 0,
            y: 380,
            duration: 1000,
            onComplete: () => switchText.destroy()
        });
    }
    
    showWaveText(text) {
        const waveText = this.add.text(640, 200, text, {
            fontSize: '48px',
            color: '#ff0000',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0);
        waveText.setDepth(100);
        
        this.tweens.add({
            targets: waveText,
            scale: 1.2,
            alpha: 0,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => waveText.destroy()
        });
    }
    
    setupEventListeners() {
        // 폭발 이벤트 처리
        this.events.on('explosion', (data) => {
            this.handleExplosion(data.x, data.y, data.damage, data.radius);
        });
        
        // 드론 생성 이벤트
        this.events.on('spawnDrone', (data) => {
            this.createDrone(data.drone, data.damage);
        });
        
        // 재장전 표시
        this.events.on('weaponReloading', (reloadTime) => {
            this.showReloadBar(reloadTime);
        });
    }
    
    handleExplosion(x, y, damage, radius) {
        // 범위 내 모든 적에게 데미지
        this.enemies.children.entries.forEach(enemy => {
            if (enemy.active) {
                const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
                if (distance <= radius) {
                    const falloffDamage = damage * (1 - distance / radius);
                    enemy.takeDamage(Math.floor(falloffDamage));
                }
            }
        });
        
        // 화면 흔들림
        this.cameras.main.shake(200, 0.01);
    }
    
    createDrone(droneSprite, damage) {
        // 간단한 자동 공격 드론
        let droneTarget = null;
        
        this.time.addEvent({
            delay: 500,
            repeat: 20,
            callback: () => {
                if (!droneSprite || !droneSprite.active) return;
                
                // 가장 가까운 적 찾기
                let nearest = null;
                let minDist = 300;
                
                this.enemies.children.entries.forEach(enemy => {
                    if (enemy.active) {
                        const dist = Phaser.Math.Distance.Between(
                            droneSprite.x, droneSprite.y,
                            enemy.x, enemy.y
                        );
                        if (dist < minDist) {
                            minDist = dist;
                            nearest = enemy;
                        }
                    }
                });
                
                if (nearest) {
                    // 드론 이동 및 공격
                    this.tweens.add({
                        targets: droneSprite,
                        x: nearest.x + Phaser.Math.Between(-50, 50),
                        y: nearest.y + Phaser.Math.Between(-50, 50),
                        duration: 400
                    });
                    
                    // 레이저 발사 효과
                    const laser = this.add.line(
                        0, 0,
                        droneSprite.x, droneSprite.y,
                        nearest.x, nearest.y,
                        0x00ffff, 0.8
                    ).setLineWidth(2);
                    
                    this.time.delayedCall(100, () => {
                        laser.destroy();
                        nearest.takeDamage(damage);
                    });
                }
            }
        });
        
        // 12초 후 드론 소멸
        this.time.delayedCall(12000, () => {
            if (droneSprite) {
                this.tweens.add({
                    targets: droneSprite,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => droneSprite.destroy()
                });
            }
        });
    }
    
    showReloadBar(reloadTime) {
        // CursorManager에서 처리하므로 이 메서드는 비워둠
        // 커서 근처에 리로드 게이지가 표시됨
    }
}