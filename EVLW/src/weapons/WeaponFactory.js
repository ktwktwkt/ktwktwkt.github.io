import BaseWeapon from './BaseWeapon.js';
import PistolWeapon from './PistolWeapon.js';
import SMGWeapon from './SMGWeapon.js';
import RifleWeapon from './RifleWeapon.js';
import ShotgunWeapon from './ShotgunWeapon.js';
import MissileWeapon from './MissileWeapon.js';
import MachineGunWeapon from './MachineGunWeapon.js';
import ChainGunWeapon from './ChainGunWeapon.js';
import StaffWeapon from './StaffWeapon.js';

const weaponMap = {
  pistol: PistolWeapon,
  smg: SMGWeapon,
  rifle: RifleWeapon,
  shotgun: ShotgunWeapon,
  missile: MissileWeapon,
  machine_gun: MachineGunWeapon,
  chain_gun: ChainGunWeapon,
  staff: StaffWeapon,
  // add other mappings
};

export default class WeaponFactory {
  static create(scene, type) {
    const WeaponClass = weaponMap[type] || BaseWeapon;
    return new WeaponClass(scene);
  }
}
