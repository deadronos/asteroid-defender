import { memo, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import Explosion from "../Explosion";
import { usePoolStore } from "../../store/poolStore";

const ExplosionLayer = memo(function ExplosionLayer() {
  const explosions = usePoolStore(useShallow((s) => s.explosions));

  const handleExplosionComplete = useCallback((id: string) => {
    usePoolStore.getState().deactivateExplosion(id);
  }, []);

  return (
    <>
      {explosions.map((exp) => (
        <Explosion
          key={exp.id}
          id={exp.id}
          position={exp.pos}
          type={exp.type}
          active={exp.active}
          onComplete={handleExplosionComplete}
        />
      ))}
    </>
  );
});

export default ExplosionLayer;