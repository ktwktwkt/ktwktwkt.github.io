import Phaser from 'phaser';
import { WeaponStats, FiringMode } from '../systems/WeaponSystem.js';

export default class Weapon {
    constructor(scene, owner, weaponType) {
        this.scene = scene;
        this.owner = owner;
        this.type = weaponType;
        this.stats = { ...WeaponStats[weaponType] };
        
        this.currentAmmo = this.stats.magazineSize;
        this.isReloading = false;
        this.lastFired = 0;
        
        this.chargeLevel = 0;
        this.isCharging = false;
        this.chargeStartTime = 0;
        
        this.level = 1;
        this.parts = [];
    }

    startCharge() {
        if (this.stats.firingMode === FiringMode.CHARGE || 
            this.stats.firingMode === FiringMode.CHARGE_RELEASE) {
            this.isCharging = true;
            this.chargeStartTime = this.scene.time.now;
        }
    }

    stopCharge() {
        if (this.isCharging) {
            const chargeTime = this.scene.time.now - this.chargeStartTime;
            this.chargeLevel = Math.min(chargeTime / (this.stats.chargeTime || 1000), 1);
            
            if (this.stats.firingMode === FiringMode.CHARGE_RELEASE) {
                if (this.stats.overchargeTime && chargeTime > this.stats.overchargeTime) {
                    this.chargeLevel = 2;
                }
                return true;
            }
            this.isCharging = false;
        }
        return false;
    }

    canFire() {
        const time = this.scene.time.now;
        
        if (this.isReloading) return false;
        if (this.currentAmmo <= 0 && !this.stats.manaRegen) return false;
        if (time < this.lastFired + this.stats.fireRate) return false;
        
        if (this.stats.firingMode === FiringMode.CHARGE_RELEASE) {
            return this.chargeLevel > 0;
        }
        
        if (this.stats.firingMode === FiringMode.CHARGE) {
            return this.chargeLevel >= 0.5;
        }
        
        return true;
    }

    fire(bullets, targetX, targetY) {
        if (!this.canFire()) return false;
        
        const angleToTarget = Phaser.Math.Angle.Between(
            this.owner.x, this.owner.y,
            targetX, targetY
        );
        
        const damage = this.calculateDamage();
        const bulletCount = this.stats.bulletCount || 1;
        
        for (let i = 0; i < bulletCount; i++) {
            const bullet = bullets.get();
            if (bullet) {
                const spread = Phaser.Math.DegToRad(
                    Phaser.Math.Between(-this.stats.spread, this.stats.spread)
                );
                
                const fireAngle = angleToTarget + spread;
                
                bullet.setTexture('bullet');
                bullet.setPosition(this.owner.x, this.owner.y);
                bullet.setActive(true);
                bullet.setVisible(true);
                
                const speed = this.stats.bulletSpeed;
                bullet.setVelocity(
                    Math.cos(fireAngle) * speed,
                    Math.sin(fireAngle) * speed
                );
                
                bullet.damage = damage;
                bullet.penetration = this.stats.penetration || 0;
                bullet.penetrationCount = 0;
                
                this.scene.time.delayedCall(this.stats.range / speed * 1000, () => {
                    if (bullet.active) {
                        bullet.destroy();
                    }
                });
            }
        }
        
        if (!this.stats.manaRegen) {
            this.currentAmmo--;
            if (this.currentAmmo <= 0) {
                this.reload();
            }
        }
        
        this.lastFired = this.scene.time.now;
        this.chargeLevel = 0;
        
        return true;
    }

    calculateDamage() {
        let damage = this.stats.damage;
        
        if (this.chargeLevel > 0) {
            if (this.chargeLevel >= 2) {
                damage *= 3;
            } else if (this.chargeLevel >= 1) {
                damage *= 2;
            } else {
                damage *= (1 + this.chargeLevel);
            }
        }
        
        damage *= (1 + (this.level - 1) * 0.1);
        
        return Math.floor(damage);
    }

    reload() {
        if (this.isReloading || this.currentAmmo === this.stats.magazineSize) return;
        if (this.stats.manaRegen) return;
        
        this.isReloading = true;
        
        this.scene.time.delayedCall(this.stats.reloadTime, () => {
            this.currentAmmo = this.stats.magazineSize;
            this.isReloading = false;
        });
    }

    upgrade() {
        this.level++;
        this.stats.damage *= 1.1;
        this.stats.magazineSize = Math.floor(this.stats.magazineSize * 1.1);
        this.currentAmmo = this.stats.magazineSize;
    }

    attachPart(part) {
        this.parts.push(part);
        
        if (part.type === 'damage') {
            this.stats.damage *= part.multiplier;
        } else if (part.type === 'fireRate') {
            this.stats.fireRate *= part.multiplier;
        } else if (part.type === 'magazine') {
            this.stats.magazineSize += part.bonus;
        } else if (part.type === 'penetration') {
            this.stats.penetration += part.bonus;
        }
    }

    update() {
        if (this.stats.manaRegen && this.currentAmmo < this.stats.magazineSize) {
            this.currentAmmo = Math.min(
                this.currentAmmo + 0.1,
                this.stats.magazineSize
            );
        }
        
        if (this.isCharging && this.stats.firingMode === FiringMode.CHARGE) {
            const chargeTime = this.scene.time.now - this.chargeStartTime;
            this.chargeLevel = Math.min(chargeTime / (this.stats.chargeTime || 1000), 1);
        }
    }
}