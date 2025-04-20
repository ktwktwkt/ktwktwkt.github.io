import BaseWeapon from './BaseWeapon.js';

export default class MissileWeapon extends BaseWeapon {
  constructor(scene) {
    super(scene);
  }
  update(time, ptr) {
    // 미사일 발사: 왼쪽 클릭 시 한 발
    if (ptr.leftButtonDown() && !this.fired) {
      this.fired = true;
      this.scene.shoot('missile', ptr, 1);
    }
    if (!ptr.leftButtonDown()) {
      this.fired = false;
    }
  }
}
