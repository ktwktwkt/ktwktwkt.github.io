import Phaser from './config/phaser.js';
import config from './config/config.js';

const game = new Phaser.Game(config);

window.game = game;
