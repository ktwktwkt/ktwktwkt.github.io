import Phaser from 'phaser';
import { PixelArtGenerator } from '../utils/PixelArtGenerator.js';

export default class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        // 픽셀아트 설정
        this.load.setPath('');
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 30, 320, 50);

        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: 'Loading...',
            style: {
                font: '20px monospace',
                color: '#ffffff'
            }
        });
        loadingText.setOrigin(0.5, 0.5);

        const percentText = this.make.text({
            x: width / 2,
            y: height / 2 - 5,
            text: '0%',
            style: {
                font: '18px monospace',
                color: '#ffffff'
            }
        });
        percentText.setOrigin(0.5, 0.5);

        this.load.on('progress', (value) => {
            percentText.setText(parseInt(value * 100) + '%');
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 20, 300 * value, 30);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            percentText.destroy();
        });

        // 픽셀아트 에셋 생성
        this.createPixelArtAssets();
    }

    createPixelArtAssets() {
        // 픽셀아트 생성기로 모든 에셋 초기화
        PixelArtGenerator.initializeAllAssets(this);
        
        // 기본 텍스처도 생성 (호환성을 위해)
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        
        // 기본 player 텍스처
        graphics.fillStyle(0x00ff00);
        graphics.fillRect(0, 0, 32, 32);
        graphics.generateTexture('player', 32, 32);
        
        // 기본 enemy 텍스처
        graphics.clear();
        graphics.fillStyle(0xff0000);
        graphics.fillRect(0, 0, 32, 32);
        graphics.generateTexture('enemy', 32, 32);
        
        // 기본 bullet 텍스처
        graphics.clear();
        graphics.fillStyle(0xffff00);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('bullet', 8, 8);
        
        graphics.destroy();
    }

    create() {
        this.scene.start('MenuScene');
    }
}