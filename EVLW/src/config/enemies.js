export const enemies = {
  melee:  { key:'enemy_melee', speed:100,  scale:1,   hp:2,   color: 0xff0000 },
  fast:   { key:'enemy_fast',  speed:150,  scale:1,   hp:1,   color: 0x00ffff },
  tank:   { key:'enemy_tank',  speed:60,   scale:1.5, hp:5,   color: 0x999999 },
  dodger: { key:'enemy_fast',  speed:120,  scale:1,   hp:3, dodge:true, color: 0xffa500 },
  boss:   { key:'enemy_boss',  speed:40,   scale:2,   hp:20,  color: 0xff00ff },
  runner: { key:'enemy_runner', speed:180, scale:1, hp:1,   color: 0xffff00 },
  jumper: { key:'enemy_jumper', speed:100, scale:1, hp:2, jump:true, color: 0x00ff00 },
  shooter: { key:'enemy_shooter', speed:80, scale:1, hp:3, shoot:true, color: 0xff00aa }
};
