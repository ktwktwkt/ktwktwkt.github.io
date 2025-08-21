import Phaser from 'phaser';
import { WeaponStats, FiringMode } from '../systems/WeaponData.js';

export default class AdvancedWeapon {
    constructor(scene, owner, weaponType) {
        this.scene = scene;
        this.owner = owner;
        this.type = weaponType;
        this.stats = { ...WeaponStats[weaponType] };
        
        // 기본 상태
        this.currentAmmo = this.stats.magazineSize;
        this.isReloading = false;
        this.lastFired = 0;
        this.hasFiredThisClick = false; // 단발 무기용
        
        // 차징 시스템
        this.chargeLevel = 0;
        this.isCharging = false;
        this.chargeStartTime = 0;
        
        // 특수 상태
        this.isSpinningUp = false;
        this.spinStartTime = 0;
        this.overheatLevel = 0;
        this.burstCount = 0;
        this.isDrawing = false;
        this.drawPower = 0;
        this.isDeployed = false;
        
        // 업그레이드
        this.level = 1;
        this.parts = [];
    }

    startFiring() {
        const special = this.stats.special || {};
        
        // 단발 무기 반복 발사 방지 초기화
        if (this.stats.firingMode === FiringMode.SINGLE) {
            this.hasFiredThisClick = false;
        }
        
        // 차징 무기
        if (this.stats.firingMode === FiringMode.CHARGE || 
            this.stats.firingMode === FiringMode.CHARGE_RELEASE) {
            this.isCharging = true;
            this.chargeStartTime = this.scene.time.now;
        }
        
        // 활 당기기
        if (this.stats.firingMode === FiringMode.DRAW) {
            this.isDrawing = true;
            this.chargeStartTime = this.scene.time.now;
        }
        
        // 체인건 스핀업
        if (special.spinUp) {
            this.isSpinningUp = true;
            this.spinStartTime = this.scene.time.now;
        }
        
        // 박격포 설치
        if (this.stats.firingMode === FiringMode.PLACEMENT && !this.isDeployed) {
            this.deployWeapon();
        }
    }

    stopFiring() {
        const special = this.stats.special || {};
        
        // 차지 릴리즈
        if (this.stats.firingMode === FiringMode.CHARGE_RELEASE && this.isCharging) {
            const chargeTime = this.scene.time.now - this.chargeStartTime;
            this.chargeLevel = Math.min(chargeTime / (special.chargeTime || 1000), 1);
            
            if (special.overchargeTime && chargeTime > special.overchargeTime) {
                this.chargeLevel = 2; // 오버차지
            }
            
            this.isCharging = false;
            return true; // 발사 신호
        }
        
        // 활 발사
        if (this.stats.firingMode === FiringMode.DRAW && this.isDrawing) {
            const drawTime = this.scene.time.now - this.chargeStartTime;
            this.drawPower = Math.min(drawTime / (special.drawTime || 800), 1);
            this.isDrawing = false;
            return true;
        }
        
        this.isCharging = false;
        this.isSpinningUp = false;
        this.isDrawing = false;
        
        return false;
    }

    canFire() {
        const time = this.scene.time.now;
        const special = this.stats.special || {};
        
        if (this.isReloading) return false;
        if (this.currentAmmo <= 0 && !special.manaRegen) return false;
        if (time < this.lastFired + this.stats.fireRate) return false;
        
        // 단발 무기는 한 번의 클릭에 한 발만
        if (this.stats.firingMode === FiringMode.SINGLE && this.hasFiredThisClick) {
            return false;
        }
        
        // 과열 체크
        if (special.overheat && this.overheatLevel >= special.overheat) {
            return false;
        }
        
        // 체인건 스핀업 체크
        if (special.spinUp) {
            const spinTime = this.scene.time.now - this.spinStartTime;
            if (!this.isSpinningUp || spinTime < special.spinUp) {
                return false;
            }
        }
        
        // 차지 무기 체크
        if (this.stats.firingMode === FiringMode.CHARGE_RELEASE) {
            return this.chargeLevel > 0;
        }
        
        if (this.stats.firingMode === FiringMode.CHARGE) {
            if (special.chargeStages) {
                // 무전기 같은 단계별 차지
                return this.chargeLevel >= 1;
            }
            return this.chargeLevel >= 0.5;
        }
        
        // 활 체크
        if (this.stats.firingMode === FiringMode.DRAW) {
            return this.drawPower > 0.3;
        }
        
        // 박격포 설치 체크
        if (this.stats.firingMode === FiringMode.PLACEMENT) {
            return this.isDeployed;
        }
        
        return true;
    }

    fire(bullets, targetX, targetY) {
        if (!this.canFire()) return false;
        
        const special = this.stats.special || {};
        const damageData = this.calculateDamage();
        const damage = typeof damageData === 'object' ? damageData.damage : damageData;
        const isCritical = typeof damageData === 'object' ? damageData.isCritical : false;
        
        // 무전기 특수 처리
        if (special.callType === 'airstrike') {
            this.callAirstrike(targetX, targetY, damage);
        } else if (special.explosive) {
            // 폭발성 무기
            this.fireExplosive(bullets, targetX, targetY, damage, isCritical);
        } else {
            // 일반 발사
            this.fireNormal(bullets, targetX, targetY, damage, isCritical);
        }
        
        // 탄약 소모
        if (!special.manaRegen) {
            this.currentAmmo--;
            if (this.currentAmmo <= 0) {
                this.reload();
            }
        }
        
        // 과열 증가
        if (special.overheat) {
            this.overheatLevel++;
        }
        
        // 반동 효과
        const recoil = this.stats.recoil || 0;
        if ((special.knockback || recoil > 0) && this.owner) {
            const angle = Phaser.Math.Angle.Between(
                this.owner.x, this.owner.y,
                targetX, targetY
            );
            const recoilForce = special.knockback || (recoil * 5);
            this.owner.setVelocity(
                this.owner.body.velocity.x - Math.cos(angle) * recoilForce,
                this.owner.body.velocity.y - Math.sin(angle) * recoilForce
            );
            
            // 화면 흔들림 (반동이 클수록 강하게, 하지만 약하게 조정)
            if (recoil > 5 && this.scene.cameras) {
                this.scene.cameras.main.shake(30, 0.0002 * recoil);  // 강도를 1/5로 줄임
            }
        }
        
        this.lastFired = this.scene.time.now;
        this.chargeLevel = 0;
        this.drawPower = 0;
        
        // 단발 무기 발사 표시
        if (this.stats.firingMode === FiringMode.SINGLE) {
            this.hasFiredThisClick = true;
        }
        
        return true;
    }

    fireNormal(bullets, targetX, targetY, damage, isCritical = false) {
        const angleToTarget = Phaser.Math.Angle.Between(
            this.owner.x, this.owner.y,
            targetX, targetY
        );
        
        const bulletCount = this.stats.bulletCount || 1;
        const special = this.stats.special || {};
        
        for (let i = 0; i < bulletCount; i++) {
            const bullet = bullets.get();
            if (bullet) {
                // 탄퍼짐 계산
                let spread = this.stats.spread;
                if (special.spreadIncrease && this.overheatLevel > 0) {
                    spread += this.overheatLevel * special.spreadIncrease;
                }
                
                const spreadAngle = Phaser.Math.DegToRad(
                    Phaser.Math.Between(-spread, spread)
                );
                
                const fireAngle = angleToTarget + spreadAngle;
                
                // 총알 설정
                this.setupBullet(bullet, fireAngle, damage, isCritical);
                
                // 특수 효과
                if (special.homing) {
                    bullet.homing = special.homing;
                    bullet.target = this.findNearestEnemy();
                }
                
                if (special.trail) {
                    this.createTrail(bullet);
                }
            }
        }
    }

    fireExplosive(bullets, targetX, targetY, damage, isCritical = false) {
        const special = this.stats.special || {};
        const bullet = bullets.get();
        
        if (bullet) {
            const angle = Phaser.Math.Angle.Between(
                this.owner.x, this.owner.y,
                targetX, targetY
            );
            
            this.setupBullet(bullet, angle, damage, isCritical);
            
            // 폭발 속성 추가
            bullet.explosive = true;
            bullet.explosionRadius = special.explosionRadius || 100;
            bullet.bounces = special.bounces || 0;
            
            // 탑다운 뷰에서는 포물선 대신 느린 속도와 큰 폭발로 표현
            if (special.arc) {
                // 중력 대신 느린 속도로 표현
                bullet.setVelocity(
                    bullet.body.velocity.x * 0.5,
                    bullet.body.velocity.y * 0.5
                );
            }
            
            // 착탄 지점 표시
            if (special.targetIndicator) {
                this.showTargetIndicator(targetX, targetY);
            }
        }
    }

    setupBullet(bullet, angle, damage, isCritical = false) {
        bullet.setTexture('bullet');
        bullet.setPosition(this.owner.x, this.owner.y);
        bullet.setActive(true);
        bullet.setVisible(true);
        bullet.setTint(this.stats.bulletColor);
        bullet.setScale(this.stats.bulletSize / 4);
        
        const speed = this.stats.bulletSpeed;
        bullet.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        );
        
        bullet.damage = damage;
        bullet.penetration = this.stats.penetration || 0;
        bullet.penetrationCount = 0;
        bullet.weaponType = this.type;
        bullet.isCritical = isCritical; // 크리티컬 여부 저장
        
        // 사거리 제한
        this.scene.time.delayedCall(this.stats.range / speed * 1000, () => {
            if (bullet.active) {
                bullet.destroy();
            }
        });
    }

    callAirstrike(x, y, damage) {
        const special = this.stats.special || {};
        
        // 목표 지점 표시
        const marker = this.scene.add.circle(x, y, special.radius, 0xff0000, 0.3);
        marker.setStrokeStyle(2, 0xff0000);
        
        // 지연 후 폭격
        this.scene.time.delayedCall(special.delay || 2000, () => {
            marker.destroy();
            
            // 폭격 효과
            for (let i = 0; i < 10; i++) {
                this.scene.time.delayedCall(i * 100, () => {
                    const offsetX = Phaser.Math.Between(-special.radius, special.radius);
                    const offsetY = Phaser.Math.Between(-special.radius, special.radius);
                    
                    this.createExplosion(x + offsetX, y + offsetY, damage / 2, special.radius / 2);
                });
            }
        });
        
        // 드론 소환
        if (special.drone) {
            this.spawnDrone();
        }
    }

    createExplosion(x, y, damage, radius) {
        // 폭발 시각 효과
        const explosion = this.scene.add.circle(x, y, radius, 0xff6600, 0.8);
        
        this.scene.tweens.add({
            targets: explosion,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 300,
            onComplete: () => explosion.destroy()
        });
        
        // 범위 데미지 (GameScene에서 처리하도록 이벤트 발생)
        this.scene.events.emit('explosion', { x, y, damage, radius });
    }

    createTrail(bullet) {
        const trail = this.scene.add.rectangle(
            bullet.x, bullet.y,
            50, 2,
            this.stats.bulletColor, 0.5
        );
        
        trail.rotation = Math.atan2(bullet.body.velocity.y, bullet.body.velocity.x);
        
        this.scene.tweens.add({
            targets: trail,
            alpha: 0,
            duration: 200,
            onComplete: () => trail.destroy()
        });
    }

    showTargetIndicator(x, y) {
        const indicator = this.scene.add.circle(x, y, 30, 0xff0000, 0.3);
        indicator.setStrokeStyle(2, 0xff0000);
        
        this.scene.tweens.add({
            targets: indicator,
            scaleX: 0.5,
            scaleY: 0.5,
            alpha: 1,
            duration: 1000,
            yoyo: true,
            repeat: 2,
            onComplete: () => indicator.destroy()
        });
    }

    deployWeapon() {
        const special = this.stats.special || {};
        
        // 설치 애니메이션
        const deployIndicator = this.scene.add.rectangle(
            this.owner.x, this.owner.y,
            40, 40,
            0x00ff00, 0.3
        );
        
        this.scene.time.delayedCall(special.deployTime || 1000, () => {
            this.isDeployed = true;
            deployIndicator.destroy();
            
            // 설치 완료 표시
            this.scene.add.text(this.owner.x, this.owner.y - 50, 'DEPLOYED!', {
                fontSize: '16px',
                color: '#00ff00'
            }).setOrigin(0.5);
        });
    }

    spawnDrone() {
        // 드론 생성 (간단한 자동 공격 유닛)
        const drone = this.scene.add.circle(
            this.owner.x, this.owner.y - 50,
            10, 0x00ffff
        );
        
        // 드론 AI는 GameScene에서 처리
        this.scene.events.emit('spawnDrone', { drone, damage: 10 });
    }

    findNearestEnemy() {
        // GameScene의 enemies 그룹에서 가장 가까운 적 찾기
        if (this.scene.enemies) {
            let nearest = null;
            let minDistance = Infinity;
            
            this.scene.enemies.children.entries.forEach(enemy => {
                if (enemy.active) {
                    const distance = Phaser.Math.Distance.Between(
                        this.owner.x, this.owner.y,
                        enemy.x, enemy.y
                    );
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearest = enemy;
                    }
                }
            });
            
            return nearest;
        }
        return null;
    }

    calculateDamage() {
        let damage = this.stats.damage;
        const special = this.stats.special || {};
        
        // 크리티컬 체크 (단발 무기 특전) - 이펙트는 실제 피격 시 표시
        let isCritical = false;
        if (special.critChance && Math.random() < special.critChance) {
            damage *= special.critDamage || 1.5;
            isCritical = true;
        }
        
        // 차지 보너스
        if (this.chargeLevel > 0) {
            if (this.chargeLevel >= 2 && special.overchargeDamage) {
                damage *= special.overchargeDamage;
            } else if (this.chargeLevel >= 1) {
                damage *= 2;
            } else {
                damage *= (1 + this.chargeLevel);
            }
        }
        
        // 활 당기기 보너스
        if (this.drawPower > 0) {
            if (this.drawPower >= 0.95 && special.perfectDraw) {
                damage *= special.perfectDraw;
            } else {
                damage *= (0.5 + this.drawPower * 0.5);
            }
        }
        
        // 레벨 보너스
        damage *= (1 + (this.level - 1) * 0.15);
        
        return {
            damage: Math.floor(damage),
            isCritical: isCritical
        };
    }

    reload() {
        if (this.isReloading || this.currentAmmo === this.stats.magazineSize) return;
        if (this.stats.special?.manaRegen) return;
        
        this.isReloading = true;
        
        // 재장전 시작 이벤트 (UI 업데이트 및 속도 감소)
        if (this.scene.events) {
            this.scene.events.emit('weaponReloading', {
                duration: this.stats.reloadTime,
                speedPenalty: this.stats.reloadSpeedPenalty || 0.5
            });
        }
        
        // UI 매니저에 재장전 표시
        if (this.scene.uiManager) {
            this.scene.uiManager.showReloadBar(this.stats.reloadTime);
        }
        
        this.scene.time.delayedCall(this.stats.reloadTime, () => {
            this.currentAmmo = this.stats.magazineSize;
            this.isReloading = false;
            this.overheatLevel = 0; // 과열 초기화
            
            // 재장전 완료 이벤트
            if (this.scene.events) {
                this.scene.events.emit('weaponReloadComplete');
            }
        });
    }

    update() {
        const special = this.stats.special || {};
        
        // 마나 재생
        if (special.manaRegen && this.currentAmmo < this.stats.magazineSize) {
            this.currentAmmo = Math.min(
                this.currentAmmo + 0.05,
                this.stats.magazineSize
            );
        }
        
        // 차징 업데이트
        if (this.isCharging && this.stats.firingMode === FiringMode.CHARGE) {
            const chargeTime = this.scene.time.now - this.chargeStartTime;
            
            if (special.chargeStages) {
                // 단계별 차징 (무전기)
                this.chargeLevel = Math.min(
                    Math.floor(chargeTime / 1000) + 1,
                    special.chargeStages
                );
            } else {
                this.chargeLevel = Math.min(chargeTime / (special.chargeTime || 1000), 1);
            }
        }
        
        // 과열 감소
        if (special.overheat && this.overheatLevel > 0 && !this.isSpinningUp) {
            this.overheatLevel = Math.max(0, this.overheatLevel - 0.1);
        }
    }
    
    upgrade() {
        this.level++;
        
        // 레벨업 시 능력치 향상
        this.stats.damage *= 1.15;
        this.stats.fireRate = Math.max(50, this.stats.fireRate * 0.9); // 발사 속도 증가
        this.stats.magazineSize = Math.floor(this.stats.magazineSize * 1.2);
        this.stats.reloadTime = Math.max(500, this.stats.reloadTime * 0.85);
        
        // 현재 탄약도 최대치로 회복
        this.currentAmmo = this.stats.magazineSize;
        
        // 업그레이드 이펙트
        if (this.owner && this.scene) {
            // 빛나는 효과
            const upgradeEffect = this.scene.add.circle(
                this.owner.x, this.owner.y,
                50, 0x00ffff, 0.5
            );
            upgradeEffect.setDepth(100);
            
            this.scene.tweens.add({
                targets: upgradeEffect,
                scale: 2,
                alpha: 0,
                duration: 500,
                onComplete: () => upgradeEffect.destroy()
            });
        }
        
        return this.level;
    }
}