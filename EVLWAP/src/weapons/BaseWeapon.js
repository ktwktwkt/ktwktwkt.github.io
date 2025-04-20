export default class BaseWeapon {
  constructor(scene) {
    this.scene = scene;
    this.config = scene.weaponConfig;
    this.type = scene.weaponType;
    this.scene = scene;
  }
  fire(ptr) {}
  update(time, ptr) {
    // 기본 무기: 왼쪽 클릭 시 발사
    if (ptr.leftButtonDown()) {
      this.scene.shoot(this.type, ptr, 1);
    }
  }
}
