import BaseWeapon from './BaseWeapon.js';

export default class RifleWeapon extends BaseWeapon {
  constructor(scene) {
    super(scene);
  }
  update(time, ptr) {
    // automatic fire
    if (ptr.isDown) {
      this.scene.shoot('rifle', ptr, 1);
    }
    // scope toggle
    if (Phaser.Input.Pointer.RIGHT_BUTTON && ptr.rightButtonDown()) {
      this.scene.isScoped = !this.scene.isScoped;
      this.scene.cameras.main.setZoom(this.scene.isScoped ? 1.2 : 1);
    }
  }
}
