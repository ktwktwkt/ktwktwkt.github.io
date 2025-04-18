const Phaser = window.Phaser;
import { weapons } from '../config/weapons.js';
export default class WeaponSelectScene extends Phaser.Scene {
  constructor(){ super('WeaponSelect'); }
  create(){
    this.input.mouse.disableContextMenu();
    // 패널용 텍스처 생성(최초 1회)
    const panelWidth = 760, panelHeight = 400;
    if (!this.textures.exists('panel')) {
      const gfx = this.add.graphics({ x: 0, y: 0, add: false });
      gfx.fillStyle(0x000000, 0.5).fillRect(0, 0, panelWidth, panelHeight);
      gfx.generateTexture('panel', panelWidth, panelHeight);
      gfx.destroy();
    }
    // 패널 이미지
    this.add.image(400, 140, 'panel').setOrigin(0.5, 0);
    // 타이틀 캐시 텍스트
    this.add.text(400, 50, '무기 선택', { font: '32px Arial', fill: '#fff', cache: true }).setOrigin(0.5);
    const keys = Object.keys(weapons);
    const colors = [0xff5555,0x55ff55,0x5555ff,0xffff55,0xff55ff,0x55ffff,0xffffff];
    const cols = 4;
    const spacingX = panelWidth / cols;
    const startX = 400 - panelWidth/2 + spacingX/2;
    const startY = 180;
    keys.forEach((key,i) => {
      const cfg = weapons[key];
      const name = key.split('_').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * spacingX;
      const y = startY + row * 120;
      // weapon icon
      this.add.circle(x, y, 30, colors[i % colors.length]).setInteractive()
        .on('pointerdown', () => this.scene.start('Game',{weapon:key}));
      // weapon name
      this.add.text(x, y + 40, name, {font:'16px Arial',fill:'#fff',cache:true}).setOrigin(0.5);
    });
  }
}