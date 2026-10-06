import Phaser from 'phaser';

const PLAYER_SPEED = 230;
const PLAYER_MAX_HP = 100;

const WAVE_CONFIG = [
  {
    zombies: 10,
    spawnInterval: 900,
  },
  {
    zombies: 15,
    spawnInterval: 800,
  },
  {
    zombies: 20,
    spawnInterval: 700,
  },
  {
    zombies: 25,
    spawnInterval: 600,
  },
];

const INTER_WAVE_DELAY = 2500;

type WeaponName =
  | 'Pistol'
  | 'SMG'
  | 'Shotgun'
  | 'Rifle';

interface WeaponConfig {
  name: WeaponName;
  damage: number;
  fireRate: number;
  bulletSpeed: number;
  pellets: number;
  spread: number;
  color: number;
}

const WEAPONS: Record<WeaponName, WeaponConfig> = {
  Pistol: {
    name: 'Pistol',
    damage: 25,
    fireRate: 350,
    bulletSpeed: 700,
    pellets: 1,
    spread: 0,
    color: 0xfacc15,
  },

  SMG: {
    name: 'SMG',
    damage: 12,
    fireRate: 90,
    bulletSpeed: 800,
    pellets: 1,
    spread: 0.08,
    color: 0x38bdf8,
  },

  Shotgun: {
    name: 'Shotgun',
    damage: 18,
    fireRate: 650,
    bulletSpeed: 600,
    pellets: 7,
    spread: 0.45,
    color: 0xfb923c,
  },

  Rifle: {
    name: 'Rifle',
    damage: 45,
    fireRate: 500,
    bulletSpeed: 1000,
    pellets: 1,
    spread: 0,
    color: 0xa78bfa,
  },
};

interface Zombie {
  body: Phaser.GameObjects.Arc;
  hp: number;
  speed: number;
  damage: number;
  lastAttack: number;
}

interface Bullet {
  body: Phaser.GameObjects.Arc;
  velocityX: number;
  velocityY: number;
  damage: number;
}

interface WeaponPickup {
  body: Phaser.GameObjects.Rectangle;
  weapon: WeaponName;
  label: Phaser.GameObjects.Text;
}

interface Obstacle {
  body: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;

  private zombies: Zombie[] = [];
  private bullets: Bullet[] = [];
  private weaponPickups: WeaponPickup[] = [];
  private obstacles: Obstacle[] = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private wasd!: Record<
    'up' | 'down' | 'left' | 'right',
    Phaser.Input.Keyboard.Key
  >;

  private mouse!: Phaser.Input.Pointer;

  private hp = PLAYER_MAX_HP;
  private score = 0;

  private currentWeapon: WeaponName = 'Pistol';

  private lastShotTime = 0;

  // ============================================================
  // WAVES
  // ============================================================

  private currentWave = 1;

  private zombiesToSpawn = 0;
  private zombiesSpawned = 0;

  private spawnTimer = 0;

  private waitingForNextWave = false;
  private nextWaveTimer = 0;

  private gameOver = false;
  private gameWon = false;

  // ============================================================
  // WEAPONS
  // ============================================================

  private weaponSpawnTimer = 0;

  // ============================================================
  // UI
  // ============================================================

  private hpText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;

  private waveMessage!: Phaser.GameObjects.Text;
  private gameMessage!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  // ============================================================
  // CREATE
  // ============================================================

  create(): void {
    this.createBackground();

    this.createObstacles();

    this.createPlayer();

    this.createUI();

    this.createInput();

    // Стартовые оружия
    this.spawnWeapon('SMG');
    this.spawnWeapon('Shotgun');

    // Первая волна
    this.startWave(1);
  }

  // ============================================================
  // BACKGROUND
  // ============================================================

  private createBackground(): void {
    const { width, height } = this.scale;

    this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x111827,
    );

    // Сетка карты
    const graphics = this.add.graphics();

    graphics.lineStyle(
      1,
      0x1f2937,
      1,
    );

    const gridSize = 48;

    for (
      let x = 0;
      x < width;
      x += gridSize
    ) {
      graphics.lineBetween(
        x,
        100,
        x,
        height,
      );
    }

    for (
      let y = 100;
      y < height;
      y += gridSize
    ) {
      graphics.lineBetween(
        0,
        y,
        width,
        y,
      );
    }

    // Верхняя панель
    this.add.rectangle(
      width / 2,
      50,
      width,
      100,
      0x020617,
    );

    this.add.text(
      24,
      16,
      'ZOMBIE SURVIVAL',
      {
        fontFamily: 'Arial',
        fontSize: '26px',
        color: '#ffffff',
        fontStyle: 'bold',
      },
    );

    this.add.text(
      24,
      53,
      'WASD — движение • ЛКМ — стрельба',
      {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#94a3b8',
      },
    );
  }

  // ============================================================
  // BUILDINGS
  // ============================================================

  private createObstacles(): void {
    /*
     * Дома находятся внутри карты.
     *
     * Края и углы специально оставлены свободными,
     * чтобы зомби могли нормально появляться.
     */

    this.createBuilding(
      190,
      205,
      130,
      75,
    );

    this.createBuilding(
      480,
      185,
      150,
      80,
    );

    this.createBuilding(
      770,
      220,
      120,
      75,
    );

    this.createBuilding(
      300,
      445,
      140,
      75,
    );

    this.createBuilding(
      650,
      445,
      150,
      80,
    );
  }

  private createBuilding(
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const body = this.add.rectangle(
      x,
      y,
      width,
      height,
      0x374151,
    );

    body.setStrokeStyle(
      3,
      0x64748b,
    );

    body.setDepth(2);

    // Крыша
    this.add.rectangle(
      x,
      y - height / 2 + 12,
      width - 18,
      8,
      0x4b5563,
    ).setDepth(3);

    // Название здания
    this.add.text(
      x,
      y,
      'HOUSE',
      {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#9ca3af',
        fontStyle: 'bold',
      },
    )
      .setOrigin(0.5)
      .setDepth(3);

    this.obstacles.push({
      body,
      x,
      y,
      width,
      height,
    });
  }

  // ============================================================
  // PLAYER
  // ============================================================

  private createPlayer(): void {
    this.player = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2 + 80,
      34,
      34,
      0x22d3ee,
    );

    this.player.setDepth(10);

    this.add.circle(
      this.player.x,
      this.player.y,
      23,
      0x22d3ee,
      0.12,
    ).setDepth(9);
  }

  // ============================================================
  // UI
  // ============================================================

  private createUI(): void {
    this.hpText = this.add.text(
      560,
      18,
      '',
      {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#ef4444',
        fontStyle: 'bold',
      },
    );

    this.waveText = this.add.text(
      560,
      48,
      '',
      {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#facc15',
        fontStyle: 'bold',
      },
    );

    this.scoreText = this.add.text(
      760,
      48,
      '',
      {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: '#ffffff',
      },
    );

    this.weaponText = this.add.text(
      24,
      this.scale.height - 38,
      '',
      {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#38bdf8',
        fontStyle: 'bold',
      },
    );

    this.waveMessage = this.add.text(
      this.scale.width / 2,
      125,
      '',
      {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#facc15',
        fontStyle: 'bold',
        align: 'center',
      },
    );

    this.waveMessage
      .setOrigin(0.5)
      .setDepth(100);

    this.gameMessage = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      '',
      {
        fontFamily: 'Arial',
        fontSize: '46px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
      },
    );

    this.gameMessage
      .setOrigin(0.5)
      .setDepth(100);

    this.gameMessage.setVisible(false);

    this.updateUI();
  }

  // ============================================================
  // INPUT
  // ============================================================

  private createInput(): void {
    if (!this.input.keyboard) {
      throw new Error(
        'Keyboard input is unavailable.',
      );
    }

    this.cursors =
      this.input.keyboard.createCursorKeys();

    this.wasd =
      this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
      }) as Record<
        'up' | 'down' | 'left' | 'right',
        Phaser.Input.Keyboard.Key
      >;

    this.mouse =
      this.input.activePointer;

    this.input.keyboard.on(
      'keydown-R',
      () => {
        if (
          this.gameOver ||
          this.gameWon
        ) {
          this.scene.restart();
        }
      },
    );
  }

  // ============================================================
  // UPDATE
  // ============================================================

  update(
    time: number,
    delta: number,
  ): void {
    if (
      this.gameOver ||
      this.gameWon
    ) {
      return;
    }

    const seconds = delta / 1000;

    this.updatePlayer(seconds);

    this.updateShooting(time);

    this.updateBullets(seconds);

    this.updateZombies(
      time,
      seconds,
    );

    this.updateWeaponPickups();

    this.updateWave(delta);

    this.updateWeapons(delta);

    this.updateUI();
  }

  // ============================================================
  // PLAYER MOVEMENT
  // ============================================================

  private updatePlayer(
    seconds: number,
  ): void {
    let dx = 0;
    let dy = 0;

    if (
      this.cursors.left.isDown ||
      this.wasd.left.isDown
    ) {
      dx -= 1;
    }

    if (
      this.cursors.right.isDown ||
      this.wasd.right.isDown
    ) {
      dx += 1;
    }

    if (
      this.cursors.up.isDown ||
      this.wasd.up.isDown
    ) {
      dy -= 1;
    }

    if (
      this.cursors.down.isDown ||
      this.wasd.down.isDown
    ) {
      dy += 1;
    }

    if (
      dx === 0 &&
      dy === 0
    ) {
      return;
    }

    const length =
      Math.hypot(dx, dy);

    dx /= length;
    dy /= length;

    const oldX = this.player.x;
    const oldY = this.player.y;

    this.player.x +=
      dx *
      PLAYER_SPEED *
      seconds;

    this.player.y +=
      dy *
      PLAYER_SPEED *
      seconds;

    const half =
      this.player.width / 2;

    // Границы карты
    this.player.x =
      Phaser.Math.Clamp(
        this.player.x,
        half,
        this.scale.width - half,
      );

    this.player.y =
      Phaser.Math.Clamp(
        this.player.y,
        100 + half,
        this.scale.height -
          40 -
          half,
      );

    // Дом
    if (
      this.isInsideObstacle(
        this.player.x,
        this.player.y,
        half,
      )
    ) {
      this.player.x = oldX;
      this.player.y = oldY;
    }
  }

  // ============================================================
  // SHOOTING
  // ============================================================

  private updateShooting(
    time: number,
  ): void {
    if (!this.mouse.isDown) {
      return;
    }

    const weapon =
      WEAPONS[
        this.currentWeapon
      ];

    if (
      time - this.lastShotTime <
      weapon.fireRate
    ) {
      return;
    }

    this.lastShotTime = time;

    this.shoot(weapon);
  }

  private shoot(
    weapon: WeaponConfig,
  ): void {
    const targetX =
      this.mouse.worldX;

    const targetY =
      this.mouse.worldY;

    const baseAngle =
      Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        targetX,
        targetY,
      );

    for (
      let i = 0;
      i < weapon.pellets;
      i++
    ) {
      const angle =
        baseAngle +
        Phaser.Math.FloatBetween(
          -weapon.spread,
          weapon.spread,
        );

      const bullet =
        this.add.circle(
          this.player.x,
          this.player.y,
          5,
          weapon.color,
        );

      bullet.setDepth(8);

      this.bullets.push({
        body: bullet,

        velocityX:
          Math.cos(angle) *
          weapon.bulletSpeed,

        velocityY:
          Math.sin(angle) *
          weapon.bulletSpeed,

        damage: weapon.damage,
      });
    }
  }

  // ============================================================
  // BULLETS
  // ============================================================

  private updateBullets(
    seconds: number,
  ): void {
    for (
      let i =
        this.bullets.length - 1;
      i >= 0;
      i--
    ) {
      const bullet =
        this.bullets[i];

      bullet.body.x +=
        bullet.velocityX *
        seconds;

      bullet.body.y +=
        bullet.velocityY *
        seconds;

      let removeBullet = false;

      // Попадание в дом
      if (
        this.isInsideObstacle(
          bullet.body.x,
          bullet.body.y,
          3,
        )
      ) {
        removeBullet = true;
      }

      // Попадание в зомби
      if (!removeBullet) {
        for (
          let j =
            this.zombies.length - 1;
          j >= 0;
          j--
        ) {
          const zombie =
            this.zombies[j];

          const distance =
            Phaser.Math.Distance.Between(
              bullet.body.x,
              bullet.body.y,
              zombie.body.x,
              zombie.body.y,
            );

          if (
            distance < 18
          ) {
            zombie.hp -=
              bullet.damage;

            removeBullet = true;

            if (
              zombie.hp <= 0
            ) {
              this.killZombie(j);
            }

            break;
          }
        }
      }

      // Пуля вышла за карту
      if (
        bullet.body.x < -20 ||
        bullet.body.x >
          this.scale.width + 20 ||
        bullet.body.y < 100 ||
        bullet.body.y >
          this.scale.height + 20
      ) {
        removeBullet = true;
      }

      if (removeBullet) {
        bullet.body.destroy();

        this.bullets.splice(
          i,
          1,
        );
      }
    }
  }

  // ============================================================
  // WAVE SYSTEM
  // ============================================================

  private startWave(
    wave: number,
  ): void {
    if (
      wave >
      WAVE_CONFIG.length
    ) {
      this.winGame();
      return;
    }

    this.currentWave = wave;

    const config =
      WAVE_CONFIG[
        wave - 1
      ];

    this.zombiesToSpawn =
      config.zombies;

    this.zombiesSpawned = 0;

    this.spawnTimer = 0;

    this.waitingForNextWave =
      false;

    this.showWaveMessage(
      `WAVE ${wave}\n${config.zombies} ZOMBIES`,
    );
  }

  private updateWave(
    delta: number,
  ): void {
    // Пауза между волнами
    if (
      this.waitingForNextWave
    ) {
      this.nextWaveTimer -=
        delta;

      if (
        this.nextWaveTimer <= 0
      ) {
        this.startWave(
          this.currentWave + 1,
        );
      }

      return;
    }

    /*
     * Постепенно спавним зомби.
     */
    if (
      this.zombiesSpawned <
      this.zombiesToSpawn
    ) {
      this.spawnTimer +=
        delta;

      const config =
        WAVE_CONFIG[
          this.currentWave - 1
        ];

      if (
        this.spawnTimer >=
        config.spawnInterval
      ) {
        this.spawnTimer = 0;

        this.spawnZombie();

        this.zombiesSpawned++;
      }

      return;
    }

    /*
     * Все зомби волны уже появились.
     *
     * Теперь ждём, пока игрок
     * убьёт последнего.
     */
    if (
      this.zombies.length === 0
    ) {
      if (
        this.currentWave >=
        WAVE_CONFIG.length
      ) {
        this.winGame();
      } else {
        this.waitingForNextWave =
          true;

        this.nextWaveTimer =
          INTER_WAVE_DELAY;

        this.showWaveMessage(
          'WAVE CLEARED!',
        );
      }
    }
  }

  // ============================================================
  // ZOMBIE SPAWN
  // ============================================================

  private spawnZombie(): void {
    const position =
      this.getSpawnPosition();

    const difficulty =
      (this.currentWave - 1) /
      (WAVE_CONFIG.length - 1);

    const hp =
      35 +
      difficulty * 25;

    const speed =
      45 +
      difficulty * 20 +
      Phaser.Math.Between(
        0,
        12,
      );

    const damage =
      7 +
      difficulty * 5;

    const zombie =
      this.add.circle(
        position.x,
        position.y,
        16,
        0x65a30d,
      );

    zombie.setDepth(5);

    this.zombies.push({
      body: zombie,
      hp,
      speed,
      damage,
      lastAttack: 0,
    });
  }

  // ============================================================
  // SAFE ZOMBIE SPAWN
  // ============================================================

  private getSpawnPosition(): {
    x: number;
    y: number;
  } {
    const margin = 35;

    /*
     * Пытаемся найти подходящую точку
     * максимум 100 раз.
     */
    for (
      let attempt = 0;
      attempt < 100;
      attempt++
    ) {
      const side =
        Phaser.Math.Between(
          0,
          3,
        );

      let x = 0;
      let y = 0;

      switch (side) {
        // Верх
        case 0:
          x = Phaser.Math.Between(
            margin,
            this.scale.width -
              margin,
          );

          y = 115;

          break;

        // Право
        case 1:
          x =
            this.scale.width -
            margin;

          y = Phaser.Math.Between(
            125,
            this.scale.height -
              margin,
          );

          break;

        // Низ
        case 2:
          x = Phaser.Math.Between(
            margin,
            this.scale.width -
              margin,
          );

          y =
            this.scale.height -
            margin;

          break;

        // Лево
        default:
          x = margin;

          y = Phaser.Math.Between(
            125,
            this.scale.height -
              margin,
          );

          break;
      }

      if (
        this.isValidZombieSpawn(
          x,
          y,
        )
      ) {
        return {
          x,
          y,
        };
      }
    }

    /*
     * Безопасный fallback.
     */
    return {
      x: 35,
      y: 120,
    };
  }

  private isValidZombieSpawn(
    x: number,
    y: number,
  ): boolean {
    /*
     * Зомби не должен появляться
     * слишком близко к игроку.
     */
    const distanceToPlayer =
      Phaser.Math.Distance.Between(
        x,
        y,
        this.player.x,
        this.player.y,
      );

    if (
      distanceToPlayer < 250
    ) {
      return false;
    }

    /*
     * Зомби не должен находиться
     * внутри здания.
     */
    if (
      this.isInsideObstacle(
        x,
        y,
        20,
      )
    ) {
      return false;
    }

    return true;
  }

  // ============================================================
  // ZOMBIE MOVEMENT
  // ============================================================

  private updateZombies(
    time: number,
    seconds: number,
  ): void {
    for (
      const zombie of this.zombies
    ) {
      const angle =
        Phaser.Math.Angle.Between(
          zombie.body.x,
          zombie.body.y,
          this.player.x,
          this.player.y,
        );

      let directionX =
        Math.cos(angle);

      let directionY =
        Math.sin(angle);

      const nextX =
        zombie.body.x +
        directionX *
          zombie.speed *
          seconds;

      const nextY =
        zombie.body.y +
        directionY *
          zombie.speed *
          seconds;

      /*
       * Если впереди дом,
       * пытаемся обойти его.
       */
      if (
        this.isInsideObstacle(
          nextX,
          nextY,
          16,
        )
      ) {
        const leftAngle =
          angle -
          Math.PI / 2;

        const rightAngle =
          angle +
          Math.PI / 2;

        const leftX =
          zombie.body.x +
          Math.cos(leftAngle) *
            zombie.speed *
            seconds;

        const leftY =
          zombie.body.y +
          Math.sin(leftAngle) *
            zombie.speed *
            seconds;

        const rightX =
          zombie.body.x +
          Math.cos(rightAngle) *
            zombie.speed *
            seconds;

        const rightY =
          zombie.body.y +
          Math.sin(rightAngle) *
            zombie.speed *
            seconds;

        const leftValid =
          !this.isInsideObstacle(
            leftX,
            leftY,
            16,
          );

        const rightValid =
          !this.isInsideObstacle(
            rightX,
            rightY,
            16,
          );

        if (
          leftValid &&
          rightValid
        ) {
          const leftDistance =
            Phaser.Math.Distance.Between(
              leftX,
              leftY,
              this.player.x,
              this.player.y,
            );

          const rightDistance =
            Phaser.Math.Distance.Between(
              rightX,
              rightY,
              this.player.x,
              this.player.y,
            );

          if (
            leftDistance <
            rightDistance
          ) {
            directionX =
              Math.cos(leftAngle);

            directionY =
              Math.sin(leftAngle);
          } else {
            directionX =
              Math.cos(rightAngle);

            directionY =
              Math.sin(rightAngle);
          }
        } else if (
          leftValid
        ) {
          directionX =
            Math.cos(leftAngle);

          directionY =
            Math.sin(leftAngle);
        } else if (
          rightValid
        ) {
          directionX =
            Math.cos(rightAngle);

          directionY =
            Math.sin(rightAngle);
        } else {
          directionX = 0;
          directionY = 0;
        }
      }

      zombie.body.x +=
        directionX *
        zombie.speed *
        seconds;

      zombie.body.y +=
        directionY *
        zombie.speed *
        seconds;

      /*
       * Атака игрока.
       */
      const distance =
        Phaser.Math.Distance.Between(
          zombie.body.x,
          zombie.body.y,
          this.player.x,
          this.player.y,
        );

      if (
        distance < 30 &&
        time -
          zombie.lastAttack >
          650
      ) {
        zombie.lastAttack = time;

        this.damagePlayer(
          zombie.damage,
        );
      }
    }
  }

  // ============================================================
  // KILL ZOMBIE
  // ============================================================

  private killZombie(
    index: number,
  ): void {
    const zombie =
      this.zombies[index];

    zombie.body.destroy();

    this.zombies.splice(
      index,
      1,
    );

    this.score += 10;
  }

  // ============================================================
  // PLAYER DAMAGE
  // ============================================================

  private damagePlayer(
    amount: number,
  ): void {
    this.hp -= amount;

    this.hp =
      Math.max(
        0,
        this.hp,
      );

    this.cameras.main.flash(
      100,
      255,
      0,
      0,
    );

    if (
      this.hp <= 0
    ) {
      this.loseGame();
    }
  }

  // ============================================================
  // WEAPON SPAWN
  // ============================================================

  private updateWeapons(
    delta: number,
  ): void {
    this.weaponSpawnTimer +=
      delta;

    /*
     * Новое оружие примерно
     * каждые 12 секунд.
     */
    if (
      this.weaponSpawnTimer <
      12000
    ) {
      return;
    }

    this.weaponSpawnTimer = 0;

    const weapons: WeaponName[] = [
      'Pistol',
      'SMG',
      'Shotgun',
      'Rifle',
    ];

    const weapon =
      Phaser.Utils.Array.GetRandom(
        weapons,
      ) as WeaponName;

    this.spawnWeapon(
      weapon,
    );
  }

  private spawnWeapon(
    weapon: WeaponName,
  ): void {
    if (
      this.weaponPickups.length >=
      3
    ) {
      return;
    }

    let x = 0;
    let y = 0;

    /*
     * Ищем место для оружия,
     * которое не находится в доме.
     */
    for (
      let attempt = 0;
      attempt < 50;
      attempt++
    ) {
      x = Phaser.Math.Between(
        70,
        this.scale.width - 70,
      );

      y = Phaser.Math.Between(
        150,
        this.scale.height - 80,
      );

      if (
        !this.isInsideObstacle(
          x,
          y,
          15,
        )
      ) {
        break;
      }
    }

    const config =
      WEAPONS[weapon];

    const body =
      this.add.rectangle(
        x,
        y,
        28,
        18,
        config.color,
      );

    body.setStrokeStyle(
      2,
      0xffffff,
    );

    body.setDepth(4);

    const label =
      this.add.text(
        x,
        y - 20,
        weapon,
        {
          fontFamily: 'Arial',
          fontSize: '13px',
          color: '#ffffff',
          fontStyle: 'bold',
        },
      );

    label
      .setOrigin(0.5)
      .setDepth(4);

    this.weaponPickups.push({
      body,
      weapon,
      label,
    });
  }

  // ============================================================
  // WEAPON PICKUP
  // ============================================================

  private updateWeaponPickups(): void {
    for (
      let i =
        this.weaponPickups.length -
        1;
      i >= 0;
      i--
    ) {
      const pickup =
        this.weaponPickups[i];

      const distance =
        Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          pickup.body.x,
          pickup.body.y,
        );

      if (
        distance > 35
      ) {
        continue;
      }

      this.currentWeapon =
        pickup.weapon;

      pickup.body.destroy();

      pickup.label.destroy();

      this.weaponPickups.splice(
        i,
        1,
      );

      this.cameras.main.flash(
        120,
        255,
        255,
        255,
      );
    }
  }

  // ============================================================
  // BUILDING COLLISION
  // ============================================================

  private isInsideObstacle(
    x: number,
    y: number,
    radius: number,
  ): boolean {
    /*
     * Небольшой дополнительный
     * запас вокруг здания.
     */
    const safetyMargin = 8;

    for (
      const obstacle of this.obstacles
    ) {
      const left =
        obstacle.x -
        obstacle.width / 2 -
        radius -
        safetyMargin;

      const right =
        obstacle.x +
        obstacle.width / 2 +
        radius +
        safetyMargin;

      const top =
        obstacle.y -
        obstacle.height / 2 -
        radius -
        safetyMargin;

      const bottom =
        obstacle.y +
        obstacle.height / 2 +
        radius +
        safetyMargin;

      if (
        x > left &&
        x < right &&
        y > top &&
        y < bottom
      ) {
        return true;
      }
    }

    return false;
  }

  // ============================================================
  // WIN
  // ============================================================

  private winGame(): void {
    if (
      this.gameWon
    ) {
      return;
    }

    this.gameWon = true;

    this.gameMessage.setVisible(
      true,
    );

    this.gameMessage.setText(
      `YOU SURVIVED!\n\n` +
        `ALL WAVES CLEARED\n\n` +
        `Kills: ${this.score / 10}\n\n` +
        `Press R to restart`,
    );

    this.gameMessage.setColor(
      '#4ade80',
    );
  }

  // ============================================================
  // LOSE
  // ============================================================

  private loseGame(): void {
    if (
      this.gameOver
    ) {
      return;
    }

    this.gameOver = true;

    this.gameMessage.setVisible(
      true,
    );

    this.gameMessage.setText(
      `YOU DIED\n\n` +
        `Wave ${this.currentWave}\n\n` +
        `Kills: ${this.score / 10}\n\n` +
        `Press R to restart`,
    );

    this.gameMessage.setColor(
      '#ef4444',
    );
  }

  // ============================================================
  // WAVE MESSAGE
  // ============================================================

  private showWaveMessage(
    message: string,
  ): void {
    this.waveMessage.setText(
      message,
    );

    this.waveMessage.setVisible(
      true,
    );

    this.waveMessage.setAlpha(
      1,
    );

    this.tweens.add({
      targets:
        this.waveMessage,

      alpha: 0,

      duration: 1500,

      onComplete: () => {
        this.waveMessage.setAlpha(
          1,
        );

        this.waveMessage.setVisible(
          false,
        );
      },
    });
  }

  // ============================================================
  // UI UPDATE
  // ============================================================

  private updateUI(): void {
    this.hpText.setText(
      `HP: ${Math.ceil(
        this.hp,
      )}/${PLAYER_MAX_HP}`,
    );

    this.waveText.setText(
      `WAVE ${this.currentWave}/${WAVE_CONFIG.length}`,
    );

    this.scoreText.setText(
      `Kills: ${this.score / 10}`,
    );

    const weapon =
      WEAPONS[
        this.currentWeapon
      ];

    this.weaponText.setText(
      `🔫 ${weapon.name}  |  Damage: ${weapon.damage}  |  Fire rate: ${weapon.fireRate}ms`,
    );
  }
}