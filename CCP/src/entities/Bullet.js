import Phaser from 'phaser';

export default class Bullet extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'bullet');
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.damage = 25;
        this.speed = 600;
        this.lifespan = 2000;
    }

    fire(x, y, angle) {
        this.setPosition(x, y);
        this.setActive(true);
        this.setVisible(true);
        
        const velocityX = Math.cos(angle) * this.speed;
        const velocityY = Math.sin(angle) * this.speed;
        this.setVelocity(velocityX, velocityY);
        
        this.scene.time.delayedCall(this.lifespan, () => {
            this.destroy();
        });
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        
        if (this.x < 0 || this.x > this.scene.game.config.width ||
            this.y < 0 || this.y > this.scene.game.config.height) {
            this.destroy();
        }
    }
}