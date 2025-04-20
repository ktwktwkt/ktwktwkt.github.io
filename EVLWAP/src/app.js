import WeaponSelectScene from './scenes/WeaponSelectScene.js';
const Phaser = window.Phaser;
import GameScene from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#222',
  fps: { target: 60 },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [WeaponSelectScene, GameScene]
};

new Phaser.Game(config);