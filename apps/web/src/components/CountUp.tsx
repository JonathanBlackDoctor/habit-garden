import { useEffect, useState } from 'react';
import { animate } from 'framer-motion';

// replayKey가 바뀔 때마다 0 → value로 카운트업. 탭 진입 시 재생용.
export default function CountUp({
  value,
  replayKey,
  duration = 0.7,
  className,
}: {
  value: number;
  replayKey?: number | string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
    // replayKey 변경 시 재생
  }, [value, replayKey, duration]);
  return <span className={className}>{display.toLocaleString()}</span>;
}
