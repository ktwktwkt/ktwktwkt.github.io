export default class SpawnManager {
  constructor(scene) {
    this.scene = scene;
    this.timer = 0;
  }
  update(delta) {
    // 스폰 속도는 전투경과시간/600으로 2000ms에서 500ms로 점차 감소
    const t = Math.min(this.scene.scenarioManager.timeElapsed / 600, 1);
    const interval = Phaser.Math.Linear(2000, 500, t);
    this.timer += delta;
    if (this.timer > interval) {
      this.timer = 0;
      // double spawn rate: spawn two enemies per interval
      for (let i = 0; i < 2; i++) {
        this.scene.spawnEnemy();
      }
    }
  }
}
