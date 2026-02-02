/**
 * Game Store unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createGameStore, insertScore, type GameStore } from './game-store';
import Decimal from 'break_eternity.js';

describe('game-store', () => {
  let store: GameStore;

  beforeEach(() => {
    store = createGameStore();
  });

  describe('createGameStore()', () => {
    it('should create a store with initial state', () => {
      const state = store.getState();

      expect(state.version).toBe('2.2.0');
      expect(state.playerName).toBe('');
      expect(state.resources.money).toBe('0');
      expect(state.resources.technique).toBe('0');
      expect(state.resources.renown).toBe('0');
    });

    it('should accept partial initial state', () => {
      const customStore = createGameStore({
        playerName: 'TestPlayer',
        resources: {
          money: '1000',
          technique: '500',
          renown: '100',
        },
      });

      const state = customStore.getState();
      expect(state.playerName).toBe('TestPlayer');
      expect(state.resources.money).toBe('1000');
    });

    it('should support subscribeWithSelector', () => {
      let capturedMoney = '';

      const unsubscribe = store.subscribe(
        (state) => state.resources.money,
        (money: string) => {
          capturedMoney = money;
        }
      );

      store.getState().addResource('money', '100');

      expect(capturedMoney).toBe('100');

      unsubscribe();
    });
  });

  describe('Resource Actions', () => {
    describe('addResource()', () => {
      it('should add to a resource', () => {
        store.getState().addResource('money', '100');

        expect(store.getState().resources.money).toBe('100');
      });

      it('should add to existing value', () => {
        store.getState().addResource('money', '100');
        store.getState().addResource('money', '50');

        expect(store.getState().resources.money).toBe('150');
      });

      it('should handle large numbers', () => {
        const largeAmount = '1e100';
        store.getState().addResource('money', largeAmount);

        const result = new Decimal(store.getState().resources.money);
        expect(result.eq(new Decimal('1e100'))).toBe(true);
      });

      it('should work with all resource types', () => {
        store.getState().addResource('money', '100');
        store.getState().addResource('technique', '50');
        store.getState().addResource('renown', '25');

        expect(store.getState().resources.money).toBe('100');
        expect(store.getState().resources.technique).toBe('50');
        expect(store.getState().resources.renown).toBe('25');
      });
    });

    describe('subtractResource()', () => {
      it('should subtract from a resource', () => {
        store.getState().addResource('money', '100');
        const success = store.getState().subtractResource('money', '30');

        expect(success).toBe(true);
        expect(store.getState().resources.money).toBe('70');
      });

      it('should return false if insufficient funds', () => {
        store.getState().addResource('money', '50');
        const success = store.getState().subtractResource('money', '100');

        expect(success).toBe(false);
        expect(store.getState().resources.money).toBe('50');
      });

      it('should not go below zero', () => {
        store.getState().addResource('money', '100');
        store.getState().subtractResource('money', '100');

        const result = new Decimal(store.getState().resources.money);
        expect(result.gte(0)).toBe(true);
      });
    });

    describe('setResource()', () => {
      it('should set a resource to a specific value', () => {
        store.getState().setResource('money', '500');

        expect(store.getState().resources.money).toBe('500');
      });

      it('should overwrite existing value', () => {
        store.getState().addResource('money', '100');
        store.getState().setResource('money', '500');

        expect(store.getState().resources.money).toBe('500');
      });
    });
  });

  describe('Minigame Actions', () => {
    describe('recordScore()', () => {
      it('should record a score', () => {
        store.getState().recordScore('code-breaker', '1000');

        const scores = store.getState().minigames['code-breaker']?.topScores;
        expect(scores).toContain('1000');
      });

      it('should maintain descending order', () => {
        store.getState().recordScore('code-breaker', '500');
        store.getState().recordScore('code-breaker', '1000');
        store.getState().recordScore('code-breaker', '750');

        const scores = store.getState().minigames['code-breaker']?.topScores;
        expect(scores).toEqual(['1000', '750', '500']);
      });

      it('should limit to 5 top scores', () => {
        for (let i = 1; i <= 7; i++) {
          store.getState().recordScore('code-breaker', String(i * 100));
        }

        const scores = store.getState().minigames['code-breaker']?.topScores;
        expect(scores).toHaveLength(5);
        expect(scores).toEqual(['700', '600', '500', '400', '300']);
      });

      it('should create minigame state if not exists', () => {
        store.getState().recordScore('new-minigame', '1000');

        const minigame = store.getState().minigames['new-minigame'];
        expect(minigame).toBeDefined();
        expect(minigame?.topScores).toContain('1000');
      });
    });

    describe('incrementPlayCount()', () => {
      it('should increment play count', () => {
        store.getState().incrementPlayCount('code-breaker');

        expect(store.getState().minigames['code-breaker']?.playCount).toBe(1);
      });

      it('should increment multiple times', () => {
        store.getState().incrementPlayCount('code-breaker');
        store.getState().incrementPlayCount('code-breaker');
        store.getState().incrementPlayCount('code-breaker');

        expect(store.getState().minigames['code-breaker']?.playCount).toBe(3);
      });
    });

    describe('unlockMinigame()', () => {
      it('should unlock a minigame', () => {
        store.getState().ensureMinigameState('new-minigame');
        store.getState().unlockMinigame('new-minigame');

        expect(store.getState().minigames['new-minigame']?.unlocked).toBe(true);
      });
    });

    describe('ensureMinigameState()', () => {
      it('should create default state for new minigame', () => {
        store.getState().ensureMinigameState('new-minigame');

        const minigame = store.getState().minigames['new-minigame'];
        expect(minigame).toBeDefined();
        expect(minigame?.unlocked).toBe(false);
        expect(minigame?.topScores).toEqual([]);
        expect(minigame?.playCount).toBe(0);
      });

      it('should not overwrite existing state', () => {
        store.getState().recordScore('code-breaker', '1000');
        store.getState().ensureMinigameState('code-breaker');

        const scores = store.getState().minigames['code-breaker']?.topScores;
        expect(scores).toContain('1000');
      });
    });
  });

  describe('Upgrade Actions', () => {
    describe('purchaseEquipmentUpgrade()', () => {
      it('should purchase an equipment upgrade', () => {
        const level = store.getState().purchaseEquipmentUpgrade('keyboard');

        expect(level).toBe(1);
        expect(store.getState().upgrades.equipment['keyboard']).toBe(1);
      });

      it('should increment upgrade level', () => {
        store.getState().purchaseEquipmentUpgrade('keyboard');
        const level = store.getState().purchaseEquipmentUpgrade('keyboard');

        expect(level).toBe(2);
        expect(store.getState().upgrades.equipment['keyboard']).toBe(2);
      });
    });

    describe('purchaseApartmentUpgrade()', () => {
      it('should purchase an apartment upgrade', () => {
        const success = store.getState().purchaseApartmentUpgrade('desk');

        expect(success).toBe(true);
        expect(store.getState().upgrades.apartment['desk']).toBe(true);
      });

      it('should return false if already purchased', () => {
        store.getState().purchaseApartmentUpgrade('desk');
        const success = store.getState().purchaseApartmentUpgrade('desk');

        expect(success).toBe(false);
      });
    });
  });

  describe('Stats Actions', () => {
    describe('addPlayTime()', () => {
      it('should add play time', () => {
        store.getState().addPlayTime(1000);

        expect(store.getState().stats.totalPlayTime).toBe(1000);
      });

      it('should accumulate play time', () => {
        store.getState().addPlayTime(1000);
        store.getState().addPlayTime(500);

        expect(store.getState().stats.totalPlayTime).toBe(1500);
      });
    });

    describe('addOfflineTime()', () => {
      it('should add offline time', () => {
        store.getState().addOfflineTime(3600000);

        expect(store.getState().stats.totalOfflineTime).toBe(3600000);
      });
    });

    describe('trackResourceEarned()', () => {
      it('should track resources earned', () => {
        store.getState().trackResourceEarned('money', '1000');

        expect(store.getState().stats.totalResourcesEarned.money).toBe('1000');
      });

      it('should accumulate tracked resources', () => {
        store.getState().trackResourceEarned('money', '1000');
        store.getState().trackResourceEarned('money', '500');

        expect(store.getState().stats.totalResourcesEarned.money).toBe('1500');
      });
    });
  });

  describe('Settings Actions', () => {
    describe('toggleOfflineProgress()', () => {
      it('should toggle offline progress setting', () => {
        expect(store.getState().settings.offlineProgressEnabled).toBe(true);

        store.getState().toggleOfflineProgress();
        expect(store.getState().settings.offlineProgressEnabled).toBe(false);

        store.getState().toggleOfflineProgress();
        expect(store.getState().settings.offlineProgressEnabled).toBe(true);
      });
    });
  });

  describe('Save/Load Actions', () => {
    describe('updateLastSaved()', () => {
      it('should update lastSaved timestamp', () => {
        const before = store.getState().lastSaved;
        store.getState().updateLastSaved();
        const after = store.getState().lastSaved;

        expect(after).toBeGreaterThanOrEqual(before);
      });
    });

    describe('updateLastPlayed()', () => {
      it('should update lastPlayed timestamp', () => {
        const before = store.getState().lastPlayed;
        store.getState().updateLastPlayed();
        const after = store.getState().lastPlayed;

        expect(after).toBeGreaterThanOrEqual(before);
      });
    });

    describe('setPlayerName()', () => {
      it('should set player name', () => {
        store.getState().setPlayerName('TestPlayer');

        expect(store.getState().playerName).toBe('TestPlayer');
      });
    });

    describe('resetGame()', () => {
      it('should reset to initial state', () => {
        // Modify state
        store.getState().setPlayerName('TestPlayer');
        store.getState().addResource('money', '1000');

        // Reset
        store.getState().resetGame();

        expect(store.getState().playerName).toBe('');
        expect(store.getState().resources.money).toBe('0');
      });
    });

    describe('loadState()', () => {
      it('should load a complete state', () => {
        const savedState = {
          version: '2.0.0',
          lastSaved: Date.now(),
          lastPlayed: Date.now(),
          playerName: 'LoadedPlayer',
          resources: {
            money: '5000',
            technique: '1000',
            renown: '500',
          },
          minigames: {
            'code-breaker': {
              unlocked: true,
              topScores: ['1000', '800', '600'],
              playCount: 10,
              upgrades: {},
            },
          },
          upgrades: {
            equipment: { keyboard: 3 },
            apartment: { desk: true },
          },
          automations: {},
          settings: {
            offlineProgressEnabled: false,
            testMode: false,
          },
          stats: {
            totalPlayTime: 3600000,
            totalOfflineTime: 1800000,
            totalResourcesEarned: {
              money: '10000',
              technique: '2000',
              renown: '1000',
            },
          },
          survivalMilestones: [300000],
          renownBonusPerMin: 10,
        };

        store.getState().loadState(savedState);

        expect(store.getState().playerName).toBe('LoadedPlayer');
        expect(store.getState().resources.money).toBe('5000');
        expect(store.getState().minigames['code-breaker']?.playCount).toBe(10);
        expect(store.getState().upgrades.equipment['keyboard']).toBe(3);
        expect(store.getState().settings.offlineProgressEnabled).toBe(false);
      });
    });
  });
});

describe('insertScore()', () => {
  it('should insert score in correct position', () => {
    const scores = ['1000', '500', '100'];
    const result = insertScore(scores, '750');

    expect(result).toEqual(['1000', '750', '500', '100']);
  });

  it('should insert at beginning if highest', () => {
    const scores = ['1000', '500'];
    const result = insertScore(scores, '2000');

    expect(result).toEqual(['2000', '1000', '500']);
  });

  it('should insert at end if lowest', () => {
    const scores = ['1000', '500'];
    const result = insertScore(scores, '100');

    expect(result).toEqual(['1000', '500', '100']);
  });

  it('should limit to 5 scores', () => {
    const scores = ['1000', '900', '800', '700', '600'];
    const result = insertScore(scores, '750');

    expect(result).toHaveLength(5);
    expect(result).toEqual(['1000', '900', '800', '750', '700']);
  });

  it('should not add score if lower than all top 5', () => {
    const scores = ['1000', '900', '800', '700', '600'];
    const result = insertScore(scores, '100');

    expect(result).toEqual(['1000', '900', '800', '700', '600']);
  });

  it('should handle empty array', () => {
    const result = insertScore([], '1000');

    expect(result).toEqual(['1000']);
  });

  it('should handle Decimal comparisons correctly', () => {
    const scores = ['1.5e10', '1e10', '5e9'];
    const result = insertScore(scores, '1.2e10');

    expect(result[0]).toBe('1.5e10');
    expect(result[1]).toBe('1.2e10');
    expect(result[2]).toBe('1e10');
  });
});
