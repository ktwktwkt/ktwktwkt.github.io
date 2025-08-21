export const WeaponType = {
    // 기본 총기류
    PISTOL: 'pistol',
    SMG: 'smg',
    SHOTGUN: 'shotgun',
    RIFLE: 'rifle',
    SNIPER: 'sniper',
    MACHINEGUN: 'machinegun',
    CHAINGUN: 'chaingun',
    
    // 폭발 무기류
    GRENADE: 'grenade',
    MORTAR: 'mortar',
    ROCKET: 'rocket',
    
    // 에너지 무기류
    RAILGUN: 'railgun',
    
    // 마법 무기류
    STAFF: 'staff',
    WAND: 'wand',
    
    // 활 계열
    BOW: 'bow',
    CROSSBOW: 'crossbow',
    
    // 특수 무기
    RADIO: 'radio'
};

export const FiringMode = {
    SINGLE: 'single',           // 단발
    AUTO: 'auto',              // 자동
    BURST: 'burst',            // 점사
    CHARGE: 'charge',          // 차지
    CHARGE_RELEASE: 'charge_release',  // 차지 후 발사
    OVERCHARGE: 'overcharge',   // 오버차지
    PLACEMENT: 'placement',     // 설치형
    DRAW: 'draw'               // 당기기 (활)
};

export const WeaponStats = {
    [WeaponType.PISTOL]: {
        name: 'PISTOL',
        damage: 40,  // 데미지 상향
        fireRate: 200,  // 빠른 발사
        magazineSize: 12,
        reloadTime: 900,  // 빠른 재장전
        reloadSpeedPenalty: 0.5,  // 재장전 중 이동속도 50%
        bulletSpeed: 1100,
        spread: 1,  // 높은 정확도
        range: 600,
        firingMode: FiringMode.SINGLE,
        bulletCount: 1,
        penetration: 1,  // 약간의 관통
        bulletColor: 0xffff00,
        bulletSize: 5,
        special: {
            doubleTab: true,
            headshotBonus: 2.5,
            critChance: 0.3,  // 30% 크리티컬
            critDamage: 2.0
        }
    },
    
    [WeaponType.SMG]: {
        name: 'SMG',
        damage: 10,
        fireRate: 60,  // 빠른 발사
        magazineSize: 40,
        reloadTime: 1500,
        reloadSpeedPenalty: 0.6,  // SMG는 빠른 재장전
        firingSpeedPenalty: 0.7,   // 발사 중 이동속도 70%
        bulletSpeed: 800,
        spread: 8,
        recoil: 2,  // 낮은 반동
        range: 400,
        firingMode: FiringMode.AUTO,
        bulletCount: 1,
        penetration: 0,
        bulletColor: 0xffffff,
        bulletSize: 3,
        special: {
            moveSpeed: 1.1,  // 이동속도 보너스
            hipFire: true    // 이동 중 명중률 패널티 감소
        }
    },
    
    [WeaponType.SHOTGUN]: {
        name: 'SHOTGUN',
        damage: 20,  // 데미지 2배 상향 (8발 x 20 = 160 최대)
        fireRate: 700,
        magazineSize: 8,
        reloadTime: 2500,
        reloadSpeedPenalty: 0.4,  // 재장전 중 이동속도 40%
        bulletSpeed: 600,
        spread: 18,  // 탄퍼짐 약간 감소
        range: 250,  // 사거리 약간 증가
        firingMode: FiringMode.SINGLE,
        bulletCount: 10,  // 펠릿 수 증가
        penetration: 0,
        bulletColor: 0xff9900,
        bulletSize: 4,  // 펠릿 크기 약간 증가
        special: {
            knockback: 200,  // 넉백 효과 증가
            closeRangeBonus: 2.5  // 근거리 데미지 보너스 증가
        }
    },
    
    [WeaponType.RIFLE]: {
        name: 'RIFLE',
        damage: 30,
        fireRate: 180,
        magazineSize: 30,
        reloadTime: 2000,
        reloadSpeedPenalty: 0.4,  // 재장전 중 이동속도 40%
        firingSpeedPenalty: 0.5,  // 발사 중 이동속도 50%
        bulletSpeed: 1000,
        spread: 2,
        recoil: 5,  // 중간 반동
        range: 700,
        firingMode: FiringMode.AUTO,
        bulletCount: 1,
        penetration: 1,
        bulletColor: 0x00ff00,
        bulletSize: 5,
        special: {
            accuracy: 0.95,  // 높은 명중률
            burstMode: true  // 점사 모드 전환 가능
        }
    },
    
    [WeaponType.SNIPER]: {
        name: 'SNIPER',
        damage: 100,
        fireRate: 1500,
        magazineSize: 5,
        reloadTime: 3000,
        bulletSpeed: 1500,
        spread: 0,
        range: 1200,
        firingMode: FiringMode.SINGLE,
        bulletCount: 1,
        penetration: 3,
        bulletColor: 0xff00ff,
        bulletSize: 6,
        special: {
            zoom: true,      // 우클릭 줌
            piercing: true,  // 관통 시 데미지 감소 없음
            slowOnAim: 0.3   // 조준 시 이동속도 감소
        }
    },
    
    [WeaponType.MACHINEGUN]: {
        name: 'MACHINEGUN',
        damage: 18,
        fireRate: 80,  // 빠른 발사
        magazineSize: 100,
        reloadTime: 4000,
        reloadSpeedPenalty: 0.3,  // 재장전 중 이동속도 30%
        firingSpeedPenalty: 0.3,  // 발사 중 이동속도 30%
        bulletSpeed: 850,
        spread: 12,
        recoil: 8,  // 높은 반동
        range: 600,
        firingMode: FiringMode.AUTO,
        bulletCount: 1,
        penetration: 1,
        bulletColor: 0xffff00,
        bulletSize: 5,
        special: {
            suppression: true,  // 제압 효과 (적 이동속도 감소)
            overheat: 50,      // 50발 연속 사격 시 과열
            spreadIncrease: 0.2  // 연사 시 탄퍼짐 증가
        }
    },
    
    [WeaponType.CHAINGUN]: {
        name: 'CHAINGUN',
        damage: 12,
        fireRate: 40,  // 매우 빠른 발사
        magazineSize: 200,
        reloadTime: 5000,
        reloadSpeedPenalty: 0.2,  // 재장전 중 이동속도 20%
        firingSpeedPenalty: 0.2,  // 발사 중 이동속도 20%
        bulletSpeed: 900,
        spread: 15,
        recoil: 10,  // 매우 높은 반동
        range: 500,
        firingMode: FiringMode.AUTO,
        bulletCount: 1,
        penetration: 2,
        bulletColor: 0xff6600,
        bulletSize: 4,
        special: {
            spinUp: 1000,     // 1초 스핀업 시간
            shred: true       // 방어력 무시 데미지
        }
    },
    
    [WeaponType.GRENADE]: {
        name: 'GRENADE',
        damage: 80,
        fireRate: 1200,
        magazineSize: 6,
        reloadTime: 3000,
        bulletSpeed: 400,
        spread: 5,
        range: 600,
        firingMode: FiringMode.SINGLE,
        bulletCount: 1,
        penetration: 0,
        bulletColor: 0x00ff00,
        bulletSize: 8,
        special: {
            explosive: true,
            explosionRadius: 100,
            bounces: 2,       // 2번 튕김
            arc: true        // 포물선 궤적
        }
    },
    
    [WeaponType.MORTAR]: {
        name: 'MORTAR',
        damage: 150,
        fireRate: 2000,
        magazineSize: 1,
        reloadTime: 3500,
        bulletSpeed: 300,
        spread: 8,
        range: 800,
        firingMode: FiringMode.PLACEMENT,
        bulletCount: 1,
        penetration: 0,
        bulletColor: 0xff0000,
        bulletSize: 10,
        special: {
            explosive: true,
            explosionRadius: 150,
            deployTime: 1000,  // 설치 시간
            indirectFire: true,  // 간접 사격
            targetIndicator: true  // 착탄 지점 표시
        }
    },
    
    [WeaponType.ROCKET]: {
        name: 'ROCKET',
        damage: 200,
        fireRate: 2500,
        magazineSize: 4,
        reloadTime: 4000,
        bulletSpeed: 500,
        spread: 2,
        range: 1000,
        firingMode: FiringMode.CHARGE,
        bulletCount: 1,
        penetration: 0,
        bulletColor: 0xff0000,
        bulletSize: 12,
        special: {
            explosive: true,
            explosionRadius: 120,
            multiShot: true,   // 차지로 다발 발사
            homing: 0.2,      // 약한 유도
            backblast: 100    // 뒤쪽 폭발 데미지
        }
    },
    
    [WeaponType.RAILGUN]: {
        name: 'RAILGUN',
        damage: 120,
        fireRate: 2000,
        magazineSize: 10,
        reloadTime: 3500,
        bulletSpeed: 2000,
        spread: 0,
        range: 1500,
        firingMode: FiringMode.CHARGE_RELEASE,
        bulletCount: 1,
        penetration: 999,  // 무한 관통
        bulletColor: 0x00ffff,
        bulletSize: 2,
        special: {
            chargeTime: 1000,
            overchargeTime: 2000,
            overchargeDamage: 3.0,
            trail: true,      // 궤적 효과
            electromagnetic: true  // 전자기 효과
        }
    },
    
    [WeaponType.STAFF]: {
        name: 'STAFF',
        damage: 50,
        fireRate: 800,
        magazineSize: 30,
        reloadTime: 0,
        bulletSpeed: 400,
        spread: 3,
        range: 600,
        firingMode: FiringMode.CHARGE,
        bulletCount: 1,
        penetration: 0,
        bulletColor: 0xff00ff,
        bulletSize: 8,
        special: {
            manaRegen: true,
            chargeTime: 500,
            magicCircle: true,  // 마법진 생성
            elementalDamage: 'random',  // 랜덤 속성
            areaEffect: 50     // 범위 효과
        }
    },
    
    [WeaponType.WAND]: {
        name: 'WAND',
        damage: 18,
        fireRate: 120,
        magazineSize: 50,
        reloadTime: 0,
        bulletSpeed: 600,
        spread: 4,
        range: 500,
        firingMode: FiringMode.AUTO,
        bulletCount: 3,  // 3발 동시
        penetration: 0,
        bulletColor: 0x9900ff,
        bulletSize: 4,
        special: {
            manaRegen: true,
            homing: 0.5,      // 유도
            chainLightning: 0.3,  // 30% 연쇄 번개
            castWhileMoving: true
        }
    },
    
    [WeaponType.BOW]: {
        name: 'BOW',
        damage: 60,
        fireRate: 1000,
        magazineSize: 1,
        reloadTime: 0,
        bulletSpeed: 800,
        spread: 1,
        range: 700,
        firingMode: FiringMode.DRAW,
        bulletCount: 1,
        penetration: 1,
        bulletColor: 0x8b4513,
        bulletSize: 6,
        special: {
            drawTime: 800,     // 당기는 시간
            perfectDraw: 1.5,  // 완벽한 타이밍 데미지
            silent: true,      // 소음 없음
            retrievable: 0.3   // 30% 화살 회수
        }
    },
    
    [WeaponType.CROSSBOW]: {
        name: 'CROSSBOW',
        damage: 80,
        fireRate: 1500,
        magazineSize: 1,
        reloadTime: 2000,
        bulletSpeed: 1200,
        spread: 0,
        range: 800,
        firingMode: FiringMode.SINGLE,
        bulletCount: 1,
        penetration: 2,
        bulletColor: 0x654321,
        bulletSize: 7,
        special: {
            boltTypes: ['normal', 'explosive', 'poison'],  // 볼트 종류
            armorPiercing: true,
            criticalChance: 0.3
        }
    },
    
    [WeaponType.RADIO]: {
        name: 'RADIO',
        damage: 100,
        fireRate: 3000,
        magazineSize: 3,
        reloadTime: 5000,
        bulletSpeed: 0,
        spread: 50,
        range: 9999,
        firingMode: FiringMode.CHARGE,
        bulletCount: 1,
        penetration: 0,
        bulletColor: 0xffff00,
        bulletSize: 0,
        special: {
            chargeStages: 3,   // 3단계 차지
            callType: 'airstrike',  // 공습 요청
            delay: 2000,       // 2초 지연
            radius: 200,       // 폭격 범위
            drone: true        // 자동 드론 소환
        }
    }
};