export const weapons = {
  // 근접/마법류
  staff:        { fireRate: 600,  reloadTime: 1200, ammoCapacity: 8,   bulletSpeed: 300, damage: 1, bulletCount: 1, chargeTime: 1000, chargeRadius: 80 },
  magic_staff:  { fireRate: 1000, reloadTime: 1500, ammoCapacity: 5,   bulletSpeed: 0,   damage: 0, bulletCount: 0, 
                   special: 'circle_damage', chargeTime: 1000 },
  // 권총/화기류
  pistol:       { fireRate: 250,  reloadTime: 1200, ammoCapacity: 12,  bulletSpeed: 600, damage: 1, bulletCount: 1 },
  smg:          { fireRate: 100,  reloadTime: 2000, ammoCapacity: 30,  bulletSpeed: 650, damage: 0.8, bulletCount: 1 },
  shotgun:      { fireRate: 800,  reloadTime: 2000, ammoCapacity: 8,   bulletSpeed: 500, damage: 1, bulletCount: 5, spread: Math.PI/40 },
  rifle:        { fireRate: 400,  reloadTime: 1800, ammoCapacity: 20,  bulletSpeed: 700, damage: 1.2, bulletCount: 1 },
  machine_gun:  { fireRate: 80,   reloadTime: 3000, ammoCapacity: 100, bulletSpeed: 800, damage: 0.2, bulletCount: 1 },
  chain_gun:    { fireRate: 30,   reloadTime: 3000, ammoCapacity: 120, bulletSpeed: 1800, damage: 0.05, bulletCount: 1, burst: true, spinUpTime: 1000 },
  sniper:       { fireRate: 1000, reloadTime: 2500, ammoCapacity: 5,   bulletSpeed: 800, damage: 5, bulletCount: 1 },
  railgun:      { fireRate: 1500, reloadTime: 3500, ammoCapacity: 3,   bulletSpeed: 1000,damage: 8, bulletCount: 1, chargeTime: 800 },
  bow:          { fireRate: 700,  reloadTime: 1500, ammoCapacity: 10,  bulletSpeed: 500, damage: 1.5, bulletCount: 1, chargeTime: 500 },
  crossbow:     { fireRate: 900,  reloadTime: 2000, ammoCapacity: 6,   bulletSpeed: 550, damage: 2, bulletCount: 1, chargeTime: 600 },
  // 폭발무기
  mortar:       { fireRate: 2000, reloadTime: 4000, ammoCapacity: 3,   bulletSpeed: 400, damage: 4, bulletCount: 1, explosionRadius: 80, arc: true },
  grenade:      { fireRate: 1200, reloadTime: 3000, ammoCapacity: 5,   bulletSpeed: 450, damage: 3, bulletCount: 1, explosionRadius: 100 },
  rocket:       { fireRate: 1200, reloadTime: 3000, ammoCapacity: 3,   bulletSpeed: 400, damage: 2, bulletCount: 1, explosionRadius: 100 },
  // 미사일: homing탄
  missile:      { fireRate: 1500, reloadTime: 3000, ammoCapacity: 5,   bulletSpeed: 350, damage: 2.5, bulletCount: 1 }
};
