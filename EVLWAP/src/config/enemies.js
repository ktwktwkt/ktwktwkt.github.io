export const enemies = {
  Bat:                { key:'Bat',                frameSize: 32, speed:80,  scale:0.8, hp:3,  actions:['idle','attack','die','fly','hit'] },
  Goblin:             { key:'Goblin',             frameSize: 32, speed:100, scale:1,   hp:4,  actions:['idle','walk','attack','hit','die'] },
  Orc:                { key:'Orc',                frameWidth:32, frameHeight:48, speed:70,  scale:1.2, hp:6,  actions:['idle','walk','attack','hit','die'] },
  Slime:              { key:'Slime',              frameSize: 32, speed:40,  scale:1,   hp:2,  actions:['idle','move','attack','hit','die'] },
  Skeleton:           { key:'Skeleton',           frameSize: 32, speed:60,  scale:1,   hp:3,  actions:['idle','walk','attack','hit','die'] },
  Demon:              { key:'Demon',              frameWidth:32, frameHeight:48, speed:90,  scale:1,   hp:5,  actions:['idle','walk','attack','hit','die'] },
  Tengu:              { key:'Tengu',              frameSize: 64, speed:120, scale:1,   hp:5,  actions:['idle','fly','attack','hit','die'] },
  Vampire:            { key:'Vampire',            frameWidth:32, frameHeight:48, speed:110, scale:1,   hp:6,  actions:['idle','walk','attack','hit','die'] },
  WolfRider:          { key:'WolfRider',          frameSize: 64, speed:100, scale:1,   hp:5,  actions:['idle','walk','attack','hit','die'] },
  Wizard:             { key:'Wizard',             frameWidth:32, frameHeight:48, speed:70,  scale:1,   hp:4,  actions:['idle','walk','attack','hit','die'] },
  FaerieDragon:       { key:'FaerieDragon',       frameSize: 64, speed:90,  scale:0.9, hp:4,  actions:['idle','fly','attack','hit','die'] },
  FrostGiant:         { key:'FrostGiant',         frameSize: 64, speed:50,  scale:1.3, hp:8,  actions:['idle','walk','attack','hit','die'] },
  AncientBlackDragon: { key:'AncientBlackDragon', frameSize: 96, speed:40,  scale:1.1, hp:20, actions:['idle','fly','attack','hit','die'] },
  YoungGreenDragon:   { key:'YoungGreenDragon',   frameSize: 64, speed: 60,  scale: 1.5, hp: 10, actions: ['idle','fly','attack','hit','die'] },
  // Boss Configuration
  boss:               { key:'AncientBlackDragon', frameSize: 96, speed:40,  scale:1.1, hp:50, actions:['idle','fly','attack','hit','die'] }
};
