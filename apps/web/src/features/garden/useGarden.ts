import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { ProgressDoc, PlantInstance } from 'shared/types/firestore';
import { PLANT_SPECIES, POINT_PRICES } from 'shared/types/firestore';
import { toast } from 'sonner';

const DEFAULT_PROGRESS: Omit<ProgressDoc, 'updatedAt'> = {
  totalPoints:      0,
  spendablePoints:  0,
  level:            1,
  xpInLevel:        0,
  globalStreak:     0,
  globalBestStreak: 0,
  gardenState: {
    plants:           [],
    unlockedSpecies:  ['sprout'],
    decorations:      [],
    health:           100,
  },
};

export function useProgress() {
  const uid = useAppStore((s) => s.uid);
  const [progress, setProgress] = useState<ProgressDoc | null>(null);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid, 'progress'), (snap) => {
      if (snap.exists()) {
        setProgress(snap.data() as ProgressDoc);
      } else {
        // 첫 방문: progress 문서 초기화
        setDoc(doc(db, 'users', uid, 'progress'), {
          ...DEFAULT_PROGRESS,
          updatedAt: serverTimestamp(),
        });
      }
    });
  }, [uid]);

  return progress;
}

export function useGardenActions() {
  const uid      = useAppStore((s) => s.uid);
  const progress = useProgress();

  const plantSeed = async (speciesId: string) => {
    if (!uid || !progress) return;
    const cost = POINT_PRICES.SEED;
    if (progress.spendablePoints < cost) {
      toast.error(`포인트가 부족합니다. (필요: ${cost}P)`);
      return;
    }
    const species = PLANT_SPECIES.find((s) => s.id === speciesId);
    if (!species) return;
    if (!progress.gardenState.unlockedSpecies.includes(speciesId)) {
      toast.error('해금되지 않은 식물입니다.');
      return;
    }

    const newPlant: PlantInstance = {
      id:        Date.now().toString(),
      speciesId,
      stage:     0,
      plantedAt: serverTimestamp() as any,
    };

    const newPlants = [...progress.gardenState.plants, newPlant];
    await setDoc(doc(db, 'users', uid, 'progress'), {
      spendablePoints: progress.spendablePoints - cost,
      gardenState: { ...progress.gardenState, plants: newPlants },
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // pointLedger
    await addDoc(collection(db, 'users', uid, 'pointLedger'), {
      delta: -cost, reason: 'spend_plant', refId: speciesId,
      createdAt: serverTimestamp(),
    });

    toast(`🌱 ${species.name} 씨앗을 심었습니다!`);
  };

  const waterPlant = async (plantId: string) => {
    if (!uid || !progress) return;
    const cost = POINT_PRICES.WATER;
    if (progress.spendablePoints < cost) {
      toast.error(`포인트가 부족합니다. (필요: ${cost}P)`);
      return;
    }
    const plants = progress.gardenState.plants.map((p) => {
      if (p.id !== plantId) return p;
      const species = PLANT_SPECIES.find((s) => s.id === p.speciesId);
      const maxStage = (species?.stages ?? 4) - 1;
      return { ...p, stage: Math.min(p.stage + 1, maxStage), witheredSince: undefined };
    });

    await setDoc(doc(db, 'users', uid, 'progress'), {
      spendablePoints: progress.spendablePoints - cost,
      gardenState: { ...progress.gardenState, plants },
      updatedAt: serverTimestamp(),
    }, { merge: true });

    await addDoc(collection(db, 'users', uid, 'pointLedger'), {
      delta: -cost, reason: 'spend_water', refId: plantId,
      createdAt: serverTimestamp(),
    });

    toast('💧 물을 줬습니다!');
  };

  const unlockSpecies = async (speciesId: string) => {
    if (!uid || !progress) return;
    const species = PLANT_SPECIES.find((s) => s.id === speciesId);
    if (!species || species.unlockCost === 0) return;
    if (progress.gardenState.unlockedSpecies.includes(speciesId)) {
      toast('이미 해금된 식물입니다.');
      return;
    }
    const cost = species.unlockCost;
    if (progress.spendablePoints < cost) {
      toast.error(`포인트가 부족합니다. (필요: ${cost}P)`);
      return;
    }
    const unlockedSpecies = [...progress.gardenState.unlockedSpecies, speciesId];
    await setDoc(doc(db, 'users', uid, 'progress'), {
      spendablePoints: progress.spendablePoints - cost,
      gardenState: { ...progress.gardenState, unlockedSpecies },
      updatedAt: serverTimestamp(),
    }, { merge: true });

    await addDoc(collection(db, 'users', uid, 'pointLedger'), {
      delta: -cost, reason: 'unlock_species', refId: speciesId,
      createdAt: serverTimestamp(),
    });

    toast(`🌿 ${species.name} 해금!`);
  };

  return { plantSeed, waterPlant, unlockSpecies };
}
