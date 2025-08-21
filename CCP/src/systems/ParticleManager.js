export default class ParticleManager {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }

    createHitEffect(x, y) {
        // 피격 스파크
        for (let i = 0; i < 5; i++) {
            const spark = this.scene.add.rectangle(
                x + Phaser.Math.Between(-10, 10),
                y + Phaser.Math.Between(-10, 10),
                2, 2,
                0xffff00
            );
            spark.setDepth(15);
            
            const angle = Math.random() * Math.PI * 2;
            const speed = Phaser.Math.Between(50, 150);
            
            this.scene.tweens.add({
                targets: spark,
                x: spark.x + Math.cos(angle) * speed,
                y: spark.y + Math.sin(angle) * speed,
                alpha: 0,
                duration: 300,
                onComplete: () => spark.destroy()
            });
        }
        
        // 히트 마커
        const hitMarker = this.scene.add.image(x, y, 'hit_effect');
        hitMarker.setDepth(16);
        hitMarker.setScale(0.5);
        
        this.scene.tweens.add({
            targets: hitMarker,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 200,
            onComplete: () => hitMarker.destroy()
        });
    }

    createBulletImpact(x, y) {
        // 총알 충돌 파티클
        for (let i = 0; i < 3; i++) {
            const particle = this.scene.add.rectangle(
                x + Phaser.Math.Between(-5, 5),
                y + Phaser.Math.Between(-5, 5),
                1, 1,
                0xffffff
            );
            particle.setDepth(14);
            
            this.scene.tweens.add({
                targets: particle,
                y: particle.y + 10,
                alpha: 0,
                duration: 200,
                onComplete: () => particle.destroy()
            });
        }
    }

    createExplosion(x, y, radius = 100) {
        // 폭발 링
        const ring = this.scene.add.circle(x, y, 10, 0xff6600, 0.8);
        ring.setDepth(20);
        
        this.scene.tweens.add({
            targets: ring,
            scaleX: radius / 10,
            scaleY: radius / 10,
            alpha: 0,
            duration: 400,
            ease: 'Power2',
            onComplete: () => ring.destroy()
        });
        
        // 폭발 파편
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i;
            const speed = Phaser.Math.Between(100, 200);
            
            const fragment = this.scene.add.rectangle(
                x, y, 4, 4,
                Phaser.Math.RND.pick([0xff0000, 0xff6600, 0xffff00])
            );
            fragment.setDepth(19);
            
            this.scene.tweens.add({
                targets: fragment,
                x: x + Math.cos(angle) * speed,
                y: y + Math.sin(angle) * speed,
                rotation: Math.random() * Math.PI * 4,
                scaleX: 0,
                scaleY: 0,
                duration: 600,
                ease: 'Power2',
                onComplete: () => fragment.destroy()
            });
        }
        
        // 스모크
        for (let i = 0; i < 3; i++) {
            this.scene.time.delayedCall(i * 100, () => {
                const smoke = this.scene.add.circle(
                    x + Phaser.Math.Between(-20, 20),
                    y + Phaser.Math.Between(-20, 20),
                    Phaser.Math.Between(20, 40),
                    0x666666,
                    0.4
                );
                smoke.setDepth(18);
                
                this.scene.tweens.add({
                    targets: smoke,
                    scaleX: 2,
                    scaleY: 2,
                    alpha: 0,
                    y: smoke.y - 30,
                    duration: 1000,
                    onComplete: () => smoke.destroy()
                });
            });
        }
    }

    createMuzzleFlash(x, y, angle) {
        const flash = this.scene.add.image(x, y, 'muzzle_flash');
        flash.setRotation(angle);
        flash.setDepth(15);
        flash.setScale(0.5);
        
        this.scene.tweens.add({
            targets: flash,
            scaleX: 1,
            scaleY: 1,
            alpha: 0,
            duration: 50,
            onComplete: () => flash.destroy()
        });
    }

    createDeathEffect(x, y) {
        // 죽음 파티클
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            const blood = this.scene.add.circle(
                x, y,
                Phaser.Math.Between(2, 4),
                0xff0000,
                0.8
            );
            blood.setDepth(11);
            
            const distance = Phaser.Math.Between(20, 50);
            
            this.scene.tweens.add({
                targets: blood,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                scaleX: 0.2,
                scaleY: 0.2,
                alpha: 0,
                duration: 800,
                ease: 'Power2',
                onComplete: () => blood.destroy()
            });
        }
        
        // 잔해 (픽셀 조각)
        for (let i = 0; i < 6; i++) {
            const debris = this.scene.add.rectangle(
                x + Phaser.Math.Between(-10, 10),
                y + Phaser.Math.Between(-10, 10),
                Phaser.Math.Between(2, 6),
                Phaser.Math.Between(2, 6),
                0x8b0000
            );
            debris.setDepth(11);
            debris.setRotation(Math.random() * Math.PI * 2);
            
            this.scene.tweens.add({
                targets: debris,
                rotation: debris.rotation + Math.PI * 2,
                alpha: 0,
                duration: 1000,
                delay: i * 50,
                onComplete: () => debris.destroy()
            });
        }
    }

    createReloadIndicator(x, y) {
        const text = this.scene.add.text(x, y - 40, 'RELOADING', {
            fontSize: '12px',
            color: '#ffff00',
            fontFamily: 'monospace'
        });
        text.setOrigin(0.5);
        text.setDepth(20);
        
        this.scene.tweens.add({
            targets: text,
            y: y - 60,
            alpha: 0,
            duration: 1000,
            onComplete: () => text.destroy()
        });
    }

    createTrail(startX, startY, endX, endY, color = 0x00ffff) {
        const trail = this.scene.add.line(
            0, 0,
            startX, startY,
            endX, endY,
            color,
            0.6
        );
        trail.setLineWidth(2);
        trail.setDepth(12);
        
        this.scene.tweens.add({
            targets: trail,
            alpha: 0,
            duration: 100,
            onComplete: () => trail.destroy()
        });
    }

    createShellCasing(x, y, angle) {
        const shell = this.scene.add.rectangle(x, y, 3, 2, 0xccaa00);
        shell.setDepth(8);
        
        const ejectAngle = angle + Math.PI / 2 + Phaser.Math.Between(-0.3, 0.3);
        const speed = Phaser.Math.Between(30, 60);
        
        this.scene.tweens.add({
            targets: shell,
            x: x + Math.cos(ejectAngle) * speed,
            y: y + Math.sin(ejectAngle) * speed,
            rotation: Math.random() * Math.PI * 4,
            alpha: 0.3,
            duration: 600,
            onComplete: () => {
                // 잠시 바닥에 남아있다가 사라짐
                this.scene.time.delayedCall(2000, () => {
                    this.scene.tweens.add({
                        targets: shell,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => shell.destroy()
                    });
                });
            }
        });
    }
}