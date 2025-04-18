export default class ScenarioManager {
  constructor(scene) {
    this.scene = scene;
    this.timeElapsed = 0;
    this.phase = 'combat';
    this.text = scene.add.text(600,10,'Phase:Combat',{font:'16px Arial',fill:'#fff'});
  }

  update(delta) {
    this.timeElapsed += delta/1000;
    if (this.phase === 'combat' && this.timeElapsed >= 600) {
      this.phase = 'escape';
    }
    this.text.setText('Phase:' + this.phase + ' ' + Math.floor(this.timeElapsed));
  }
}
