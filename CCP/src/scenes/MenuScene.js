import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.add.text(width / 2, height / 2 - 100, 'TOP-DOWN ARPG', {
            fontSize: '48px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const startButton = this.add.text(width / 2, height / 2, 'START GAME', {
            fontSize: '32px',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5);

        startButton.setInteractive({ useHandCursor: true });
        
        startButton.on('pointerover', () => {
            startButton.setStyle({ backgroundColor: '#555555' });
        });

        startButton.on('pointerout', () => {
            startButton.setStyle({ backgroundColor: '#333333' });
        });

        startButton.on('pointerdown', () => {
            this.scene.start('GameScene');
        });

        this.add.text(width / 2, height - 50, 'Use WASD to move, Mouse to aim and shoot', {
            fontSize: '16px',
            color: '#888888'
        }).setOrigin(0.5);
    }
}