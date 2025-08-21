import Phaser from 'phaser';
import AdvancedWeapon from './AdvancedWeapon.js';
import { WeaponType } from '../systems/WeaponData.js';

export default class PixelPlayer extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'player_pixel');
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.setCollideWorldBounds(true);
        this.setDrag(500);
        this.setDepth(10);
        
        // 스탯
        this.health = 100;
        this.maxHealth = 100;
        this.speed = 300;
        this.score = 0;
        this.invulnerable = false;
        
        // 무기 시스템
        this.currentWeapon = new AdvancedWeapon(scene, this, WeaponType.PISTOL);
        this.isMouseDown = false;
        
        // 애니메이션 상태
        this.animState = 'idle';
        this.footstepTimer = 0;
        
        // 그림자
        this.createShadow();
        
        // 발자국 효과
        this.footprints = [];
        
        // 대시 능력
        this.canDash = true;
        this.dashCooldown = 1000;
        
        // 애니메이션 시작
        this.startIdleAnimation();
    }
    
    createShadow() {
        this.shadow = this.scene.add.ellipse(
            this.x,
            this.y + 16,
            24, 12,
            0x000000,
            0.4
        );
        this.shadow.setDepth(this.depth - 1);
    }
    
    startIdleAnimation() {
        // 숨쉬기 애니메이션
        this.idleAnim = this.scene.tweens.add({
            targets: this,
            scaleY: 1.05,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // 눈 깜빡임 애니메이션
        this.scene.time.addEvent({
            delay: Phaser.Math.Between(2000, 4000),
            callback: () => {
                if (this.active && this.animState === 'idle') {
                    this.setTint(0xffffff);
                    this.scene.time.delayedCall(100, () => {
                        this.clearTint();
                    });
                }
            },
            loop: true
        });
    }
    
    update(cursors, wasd, pointer) {
        // 이동 입력
        const left = cursors.left.isDown || wasd.A.isDown;
        const right = cursors.right.isDown || wasd.D.isDown;
        const up = cursors.up.isDown || wasd.W.isDown;
        const down = cursors.down.isDown || wasd.S.isDown;
        
        // 속도 계산
        let velocityX = 0;
        let velocityY = 0;
        
        if (left) velocityX = -this.speed;
        if (right) velocityX = this.speed;
        if (up) velocityY = -this.speed;
        if (down) velocityY = this.speed;
        
        // 대각선 이동 시 속도 정규화
        if (velocityX !== 0 && velocityY !== 0) {
            velocityX *= 0.707;
            velocityY *= 0.707;
        }
        
        this.setVelocity(velocityX, velocityY);
        
        // 탑다운 뷰에서는 항상 아래쪽을 향함
        this.setRotation(0);
        
        // 무기 업데이트
        if (this.currentWeapon) {
            this.currentWeapon.update();
        }
        
        // 애니메이션 업데이트
        this.updateAnimation();
        
        // 그림자 업데이트
        this.updateShadow();
        
        // 발자국 효과
        this.updateFootprints();
    }
    
    updateAnimation() {
        const velocity = this.body.velocity.length();
        
        if (velocity > 10) {
            // 걷기/달리기 애니메이션
            this.animState = 'move';
            
            // 좌우 흔들림
            if (!this.moveAnim) {
                if (this.idleAnim) {
                    this.idleAnim.stop();
                    this.idleAnim = null;
                }
                
                this.moveAnim = this.scene.tweens.add({
                    targets: this,
                    scaleX: 0.95,
                    duration: 200,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
            
            // 발소리 타이머
            this.footstepTimer++;
            if (this.footstepTimer % 15 === 0) {
                this.createFootstep();
                // 발소리 효과음
                if (this.scene.soundManager) {
                    this.scene.soundManager.playFootstep();
                }
            }
        } else {
            // 대기 애니메이션
            this.animState = 'idle';
            
            if (this.moveAnim) {
                this.moveAnim.stop();
                this.moveAnim = null;
                this.setScale(1, 1);
                
                // 다시 숨쉬기 애니메이션
                if (!this.idleAnim) {
                    this.startIdleAnimation();
                }
            }
        }
    }
    
    updateShadow() {
        if (this.shadow) {
            this.shadow.x = this.x;
            this.shadow.y = this.y + 16;
            
            // 움직일 때 그림자 크기 변화
            const velocity = this.body.velocity.length();
            const scale = 1 + (velocity / this.speed) * 0.2;
            this.shadow.scaleX = scale;
        }
    }
    
    createFootstep() {
        const footprint = this.scene.add.circle(
            this.x + Phaser.Math.Between(-5, 5),
            this.y + Phaser.Math.Between(-5, 5),
            2,
            0x333333,
            0.3
        );
        footprint.setDepth(1);
        
        this.footprints.push(footprint);
        
        // 페이드 아웃
        this.scene.tweens.add({
            targets: footprint,
            alpha: 0,
            duration: 2000,
            onComplete: () => {
                footprint.destroy();
                const index = this.footprints.indexOf(footprint);
                if (index > -1) {
                    this.footprints.splice(index, 1);
                }
            }
        });
        
        // 최대 발자국 수 제한
        if (this.footprints.length > 20) {
            const oldest = this.footprints.shift();
            if (oldest) oldest.destroy();
        }
    }
    
    updateFootprints() {
        // 발자국 관리 (필요시 추가 로직)
    }
    
    dash() {
        if (!this.canDash) return;
        
        const dashDistance = 150;
        const dashDuration = 200;
        
        // 대시 방향 계산
        const velocityAngle = Math.atan2(this.body.velocity.y, this.body.velocity.x);
        const dashX = this.x + Math.cos(velocityAngle) * dashDistance;
        const dashY = this.y + Math.sin(velocityAngle) * dashDistance;
        
        // 대시 사운드
        if (this.scene.soundManager) {
            this.scene.soundManager.playDash();
        }
        
        // 대시 애니메이션
        this.scene.tweens.add({
            targets: this,
            x: dashX,
            y: dashY,
            duration: dashDuration,
            ease: 'Power2'
        });
        
        // 잔상 효과
        for (let i = 0; i < 5; i++) {
            this.scene.time.delayedCall(i * 40, () => {
                const afterimage = this.scene.add.sprite(this.x, this.y, 'player_pixel');
                afterimage.setRotation(this.rotation);
                afterimage.setAlpha(0.5 - i * 0.1);
                afterimage.setTint(0x00ffff);
                afterimage.setDepth(this.depth - 1);
                
                this.scene.tweens.add({
                    targets: afterimage,
                    alpha: 0,
                    scaleX: 0.5,
                    scaleY: 0.5,
                    duration: 300,
                    onComplete: () => afterimage.destroy()
                });
            });
        }
        
        // 쿨다운
        this.canDash = false;
        this.scene.time.delayedCall(this.dashCooldown, () => {
            this.canDash = true;
        });
    }
    
    shoot(bullets, targetX, targetY) {
        if (this.currentWeapon) {
            const fired = this.currentWeapon.fire(bullets, targetX, targetY);
            
            if (fired) {
                // 반동 애니메이션
                this.scene.tweens.add({
                    targets: this,
                    scaleX: 0.9,
                    scaleY: 1.1,
                    duration: 50,
                    yoyo: true
                });
                
                // 총구 화염
                this.createMuzzleFlash();
                
                // 발사음 효과
                if (this.scene.soundManager) {
                    this.scene.soundManager.playShoot(this.currentWeapon.type);
                }
            }
        }
    }
    
    createMuzzleFlash() {
        // 총구 위치 계산 (탑다운 뷰에서는 보통 캐릭터 진행 방향)
        // 현재 무기와 타겟 방향을 기준으로 계산
        if (!this.currentWeapon) return;
        
        const pointer = this.scene.input.activePointer;
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const angle = Phaser.Math.Angle.Between(this.x, this.y, worldPoint.x, worldPoint.y);
        
        // 총구 위치 (캐릭터 중심에서 약간 옆으로 치우친 위치)
        const flashDistance = 25; // 총구까지의 거리
        const flashX = this.x + Math.cos(angle) * flashDistance;
        const flashY = this.y + Math.sin(angle) * flashDistance;
        
        const flash = this.scene.add.circle(flashX, flashY, 8, 0xffff00, 0.8);
        flash.setDepth(this.depth + 1);
        
        this.scene.tweens.add({
            targets: flash,
            scale: 0,
            alpha: 0,
            duration: 100,
            onComplete: () => flash.destroy()
        });
    }
    
    startShooting() {
        this.isMouseDown = true;
        if (this.currentWeapon) {
            this.currentWeapon.startFiring();
        }
    }
    
    stopShooting() {
        this.isMouseDown = false;
        if (this.currentWeapon) {
            const shouldFire = this.currentWeapon.stopFiring();
            if (shouldFire) {
                const pointer = this.scene.input.activePointer;
                const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
                this.shoot(this.scene.bullets, worldPoint.x, worldPoint.y);
            }
        }
    }
    
    reload() {
        if (this.currentWeapon) {
            this.currentWeapon.reload();
            
            // 재장전 애니메이션
            this.scene.tweens.add({
                targets: this,
                angle: this.angle + 360,
                duration: this.currentWeapon.stats.reloadTime,
                ease: 'Power2'
            });
        }
    }
    
    switchWeapon(weaponType) {
        this.currentWeapon = new AdvancedWeapon(this.scene, this, weaponType);
        
        // 무기 전환 애니메이션
        this.scene.tweens.add({
            targets: this,
            scaleX: 1.2,
            scaleY: 0.8,
            duration: 100,
            yoyo: true
        });
    }
    
    takeDamage(damage) {
        if (this.invulnerable) return;
        
        this.health -= damage;
        this.invulnerable = true;
        
        // 피격 애니메이션
        this.setTint(0xff0000);
        this.scene.cameras.main.shake(100, 0.002);  // 강도 줄임
        
        // 피격 파티클 (개수와 범위 감소)
        for (let i = 0; i < 3; i++) {  // 8개에서 3개로 감소
            const particle = this.scene.add.rectangle(
                this.x + Phaser.Math.Between(-5, 5),  // 범위 감소
                this.y + Phaser.Math.Between(-5, 5),  // 범위 감소
                2, 2,  // 크기 감소
                0xff0000
            );
            particle.setDepth(this.depth + 5);
            
            const angle = (Math.PI * 2 / 3) * i;
            this.scene.tweens.add({
                targets: particle,
                x: particle.x + Math.cos(angle) * 15,  // 거리 감소
                y: particle.y + Math.sin(angle) * 15,  // 거리 감소
                alpha: 0,
                duration: 300,  // 시간 감소
                onComplete: () => particle.destroy()
            });
        }
        
        // 무적 시간
        this.scene.time.delayedCall(1000, () => {
            this.invulnerable = false;
            this.clearTint();
        });
        
        // 무적 깜빡임
        let blinkCount = 0;
        const blinkTimer = this.scene.time.addEvent({
            delay: 100,
            callback: () => {
                this.setAlpha(this.alpha === 1 ? 0.5 : 1);
                blinkCount++;
                if (blinkCount >= 10) {
                    blinkTimer.remove();
                    this.setAlpha(1);
                }
            },
            repeat: 10
        });
        
        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }
    
    die() {
        this.setActive(false);
        
        // 죽음 애니메이션
        this.scene.tweens.add({
            targets: this,
            scale: 0,
            angle: 720,
            duration: 1000,
            onComplete: () => {
                this.setVisible(false);
                if (this.shadow) this.shadow.destroy();
            }
        });
        
        // 죽음 파티클 폭발
        for (let i = 0; i < 20; i++) {
            const particle = this.scene.add.circle(
                this.x,
                this.y,
                Phaser.Math.Between(2, 6),
                0x00ff00
            );
            particle.setDepth(this.depth + 10);
            
            const angle = (Math.PI * 2 / 20) * i;
            const distance = Phaser.Math.Between(50, 150);
            
            this.scene.tweens.add({
                targets: particle,
                x: this.x + Math.cos(angle) * distance,
                y: this.y + Math.sin(angle) * distance,
                scale: 0,
                alpha: 0,
                duration: 1000,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }
    }
    
    heal(amount) {
        this.health = Math.min(this.health + amount, this.maxHealth);
        
        // 힐 사운드
        if (this.scene.soundManager) {
            this.scene.soundManager.playPickup();
        }
        
        // 힐 이펙트
        const healEffect = this.scene.add.circle(this.x, this.y, 30, 0x00ff00, 0.3);
        healEffect.setDepth(this.depth - 1);
        
        this.scene.tweens.add({
            targets: healEffect,
            scale: 2,
            alpha: 0,
            duration: 500,
            onComplete: () => healEffect.destroy()
        });
        
        // 힐 파티클
        for (let i = 0; i < 6; i++) {
            const particle = this.scene.add.text(
                this.x + Phaser.Math.Between(-20, 20),
                this.y + Phaser.Math.Between(-20, 20),
                '+',
                { fontSize: '16px', color: '#00ff00' }
            );
            particle.setDepth(this.depth + 5);
            
            this.scene.tweens.add({
                targets: particle,
                y: particle.y - 30,
                alpha: 0,
                duration: 1000,
                onComplete: () => particle.destroy()
            });
        }
    }
}