import Phaser from 'phaser';
import AdvancedWeapon from './AdvancedWeapon.js';
import { WeaponType } from '../systems/WeaponData.js';

export default class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'player');
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.setCollideWorldBounds(true);
        this.setDrag(500);
        
        this.health = 100;
        this.maxHealth = 100;
        this.speed = 300;
        this.baseSpeed = 300;  // 기본 속도 저장
        this.speedModifier = 1.0;  // 속도 보정치
        this.score = 0;
        this.invulnerable = false;
        this.isReloading = false;  // 재장전 상태
        
        // 무기 시스템
        this.currentWeapon = new AdvancedWeapon(scene, this, WeaponType.PISTOL);
        this.isMouseDown = false;
        
        // 재장전 이벤트 리스너
        this.setupReloadListeners();
    }

    update(cursors, wasd, pointer) {
        const left = cursors.left.isDown || wasd.A.isDown;
        const right = cursors.right.isDown || wasd.D.isDown;
        const up = cursors.up.isDown || wasd.W.isDown;
        const down = cursors.down.isDown || wasd.S.isDown;
        
        // 현재 속도 (보정치 적용)
        const currentSpeed = this.baseSpeed * this.speedModifier;

        if (left) {
            this.setVelocityX(-currentSpeed);
        } else if (right) {
            this.setVelocityX(currentSpeed);
        } else {
            this.setVelocityX(0);
        }

        if (up) {
            this.setVelocityY(-currentSpeed);
        } else if (down) {
            this.setVelocityY(currentSpeed);
        } else {
            this.setVelocityY(0);
        }

        const angle = Phaser.Math.Angle.Between(this.x, this.y, pointer.worldX, pointer.worldY);
        this.setRotation(angle + Math.PI / 2);
        
        // 무기 업데이트
        if (this.currentWeapon) {
            this.currentWeapon.update();
        }
    }

    shoot(bullets, targetX, targetY) {
        if (this.currentWeapon) {
            this.currentWeapon.fire(bullets, targetX, targetY);
        }
    }
    
    startShooting() {
        this.isMouseDown = true;
        if (this.currentWeapon) {
            this.currentWeapon.startFiring();
            
            // 연사 무기의 경우 발사 중 이동속도 감소
            const weaponStats = this.currentWeapon.stats;
            if (weaponStats.firingMode === 'auto' && weaponStats.firingSpeedPenalty) {
                this.speedModifier = weaponStats.firingSpeedPenalty;
            }
        }
    }
    
    stopShooting() {
        this.isMouseDown = false;
        if (this.currentWeapon) {
            const shouldFire = this.currentWeapon.stopFiring();
            if (shouldFire) {
                // 차지 릴리즈나 활 발사
                this.shoot(this.scene.bullets, this.scene.input.activePointer.worldX, this.scene.input.activePointer.worldY);
            }
            
            // 발사 중지 시 속도 복구 (재장전 중이 아닌 경우)
            if (!this.isReloading) {
                this.speedModifier = 1.0;
            }
        }
    }
    
    reload() {
        if (this.currentWeapon) {
            this.currentWeapon.reload();
        }
    }
    
    switchWeapon(weaponType) {
        this.currentWeapon = new AdvancedWeapon(this.scene, this, weaponType);
    }

    takeDamage(damage) {
        if (!this.invulnerable) {
            this.health -= damage;
            this.invulnerable = true;
            
            this.setTint(0xff0000);
            
            this.scene.time.delayedCall(1000, () => {
                this.invulnerable = false;
                this.clearTint();
            });
            
            if (this.health <= 0) {
                this.health = 0;
                this.setActive(false);
                this.setVisible(false);
            }
        }
    }
    
    setupReloadListeners() {
        // 재장전 시작 이벤트
        this.scene.events.on('weaponReloading', (data) => {
            this.isReloading = true;
            this.speedModifier = data.speedPenalty || 0.5;
        });
        
        // 재장전 완료 이벤트
        this.scene.events.on('weaponReloadComplete', () => {
            this.isReloading = false;
            this.speedModifier = 1.0;
        });
    }
    
    heal(amount) {
        this.health = Math.min(this.health + amount, this.maxHealth);
    }
    
    dash() {
        if (this.isReloading) return; // 재장전 중에는 대시 불가
        
        const dashSpeed = 800;
        const dashDuration = 200;
        
        // 현재 이동 방향으로 대시
        const vx = this.body.velocity.x;
        const vy = this.body.velocity.y;
        
        if (vx !== 0 || vy !== 0) {
            const angle = Math.atan2(vy, vx);
            this.setVelocity(
                Math.cos(angle) * dashSpeed,
                Math.sin(angle) * dashSpeed
            );
            
            // 대시 이펙트
            this.setAlpha(0.5);
            
            this.scene.time.delayedCall(dashDuration, () => {
                this.setAlpha(1);
            });
        }
    }
}