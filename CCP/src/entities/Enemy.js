import Phaser from 'phaser';

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'enemy');
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.setCollideWorldBounds(true);
        
        this.health = 50;
        this.maxHealth = 50;
        this.speed = 100;
        this.detectionRange = 300;
        this.attackRange = 50;
    }

    update(player) {
        if (!player || !player.active) {
            this.setVelocity(0, 0);
            return;
        }

        const distance = Phaser.Math.Distance.Between(
            this.x, this.y,
            player.x, player.y
        );

        if (distance < this.detectionRange) {
            const angle = Phaser.Math.Angle.Between(
                this.x, this.y,
                player.x, player.y
            );

            this.setRotation(angle + Math.PI / 2);

            if (distance > this.attackRange) {
                const velocityX = Math.cos(angle) * this.speed;
                const velocityY = Math.sin(angle) * this.speed;
                this.setVelocity(velocityX, velocityY);
            } else {
                this.setVelocity(0, 0);
            }
        } else {
            this.setVelocity(0, 0);
        }
    }

    takeDamage(damage) {
        this.health -= damage;
        
        this.setTint(0xffffff);
        this.scene.time.delayedCall(100, () => {
            this.clearTint();
        });

        if (this.health <= 0) {
            this.destroy();
        }
    }
}