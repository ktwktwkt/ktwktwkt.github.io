import BaseWeapon from './BaseWeapon.js';

export default class PistolWeapon extends BaseWeapon {
  constructor(scene) {
    super(scene);
    this.prevLeft = false;
    this.prevRight = false;
  }
  update(time, ptr) {
    // rising edge detection for single shot
    const isDown = ptr.leftButtonDown();
    if (isDown && !this.prevLeft) {
      this.scene.shoot('pistol', ptr, 1);
    }
    this.prevLeft = isDown;
    // burst on right-click edge
    const isRight = ptr.rightButtonDown();
    if (isRight && !this.prevRight) {
      for (let i = 0; i < 3; i++) {
        this.scene.time.delayedCall(i * 100, () => this.scene.fireRegular(ptr, 1));
      }
    }
    this.prevRight = isRight;
  }
}
