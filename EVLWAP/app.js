import * as Phaser from './node_modules/phaser/dist/phaser.esm.js';
import WeaponSelectScene from './src/scenes/WeaponSelectScene.js';
import GameScene from './src/scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#222',
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [WeaponSelectScene, GameScene]
};

window.game = new Phaser.Game(config);
