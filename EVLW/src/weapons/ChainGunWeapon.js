import BaseWeapon from './BaseWeapon.js';

export default class ChainGunWeapon extends BaseWeapon {
  constructor(scene) {
    super(scene);
  }
  update(time, ptr) {
    // 체인건은 initInput의 pointerdown/pointerup 이벤트로 제어됩니다.
  }
}
