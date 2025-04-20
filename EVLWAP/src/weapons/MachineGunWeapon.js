import BaseWeapon from './BaseWeapon.js';

export default class MachineGunWeapon extends BaseWeapon {
  constructor(scene) {
    super(scene);
  }
  update(time, ptr) {
    // 머신건 자동 사격
    if (ptr.isDown) {
      this.scene.shoot('machine_gun', ptr, 1);
    }
  }
}
