import BaseWeapon from './BaseWeapon.js';

export default class SMGWeapon extends BaseWeapon {
  constructor(scene) {
    super(scene);
    this.lastSmgTime = 0;
  }
  update(time, ptr) {
    // 3점사 자동: 왼쪽+오른쪽 버튼 조합
    if (ptr.leftButtonDown() && ptr.rightButtonDown()) {
      if (time > this.lastSmgTime + this.config.fireRate) {
        this.lastSmgTime = time;
        this.scene.smgBurst(ptr);
      }
    }
  }
}
