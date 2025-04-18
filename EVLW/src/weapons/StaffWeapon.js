import BaseWeapon from './BaseWeapon.js';

export default class StaffWeapon extends BaseWeapon {
  constructor(scene) {
    super(scene);
  }
  update(time, ptr) {
    // 스태프는 포인터 이벤트(initInput)로 차징 및 발사 처리하므로 기본 발사 로직 비활성
  }
}
