export default class UpgradeManager {
  constructor(scene) {
    this.scene = scene;
    this.killCount = 0;
    this.level = 0;
    this.text = scene.add.text(600,30,'UpLv:0',{font:'16px Arial',fill:'#fff'});
    // 업그레이드 가능한 옵션 목록
    this.upgrades = [
      { name:'탄속 증가', apply: () => { scene.bullets.children.iterate(b => b.body.speed *= 1.1); } },
      { name:'데미지 증가', apply: () => { scene.bullets.children.iterate(b => b.damage += 1); } },
      { name:'쿨타임 감소', apply: () => { scene.specialCooldown = Math.max(0, scene.specialCooldown - 1); } },
      { name:'체력 회복', apply: () => { scene.health = Math.min(5, scene.health + 1); scene.healthText.setText('HP:'+scene.health); } }
    ];
  }
  onKill() {
    this.killCount++;
    const next = (this.level + 1) * 10;
    if (this.killCount >= next) {
      this.level++;
      this.killCount = 0;
      this.text.setText('UpLv:' + this.level);
      // 랜덤 업그레이드 적용
      const u = Phaser.Math.RND.pick(this.upgrades);
      u.apply();
      console.log('Applied upgrade:', u.name);
    }
  }
}
