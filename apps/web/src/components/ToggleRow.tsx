import React from 'react';

/** 설정 화면 공용 토글 행. (More·알림 설정 등에서 공유) */
export default function ToggleRow({
  icon, label, desc, value, onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:opacity-70"
    >
      {icon}
      <div className="flex-1">
        <p className="text-sm text-[var(--fg-primary)]">{label}</p>
        {desc && <p className="text-[10px] text-[var(--fg-faint)]">{desc}</p>}
      </div>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          value ? 'bg-[var(--leaf)]' : 'bg-[var(--leaf-soft)]'
        }`}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
          style={{ transform: `translateX(${value ? 18 : 2}px)` }}
        />
      </span>
    </button>
  );
}
