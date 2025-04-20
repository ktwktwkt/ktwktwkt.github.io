import BaseWeapon from './BaseWeapon.js';

export default class ShotgunWeapon extends BaseWeapon {
  constructor(scene) {
    super(scene);
  }
  update(time, ptr) {
    // 산탄 발사 (왼쪽 버튼 클릭)
    if (ptr.leftButtonDown()) {
      this.scene.shoot('shotgun', ptr, 1);
    }
  }
}
