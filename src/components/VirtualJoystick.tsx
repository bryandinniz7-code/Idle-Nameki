import React, { useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';

interface VirtualJoystickProps {
  onVectorChange: (vec: { dx: number; dy: number }) => void;
  onTargetNearest: () => void;
  hasTarget: boolean;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  onVectorChange,
  onTargetNearest,
  hasTarget,
}) => {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const maxRadius = 38;

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    setKnob({ x: dx, y: dy });
    if (dist < 6) {
      onVectorChange({ dx: 0, dy: 0 });
    } else {
      onVectorChange({ dx: dx / maxRadius, dy: dy / maxRadius });
    }
  };

  const resetKnob = () => {
    setDragging(false);
    setKnob({ x: 0, y: 0 });
    onVectorChange({ dx: 0, dy: 0 });
  };

  return (
    <div className="flex flex-col items-center gap-3 select-none touch-none">
      {/* Target Lock Button (above joystick like NTO/Tibia mobile) */}
      <button
        type="button"
        onClick={onTargetNearest}
        title="Travar alvo no monstro mais próximo (Tab)"
        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-lg transition-colors cursor-pointer ${
          hasTarget
            ? 'bg-[#0B0F17]/90 border-red-500 text-red-400'
            : 'bg-[#0B0F17]/85 border-sky-400/70 text-sky-300 hover:border-sky-300'
        }`}
      >
        <Crosshair className="w-6 h-6" />
      </button>

      {/* Analog Joystick Pad */}
      <div
        ref={baseRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          updateFromClient(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!dragging) return;
          updateFromClient(e.clientX, e.clientY);
        }}
        onPointerUp={resetKnob}
        onPointerCancel={resetKnob}
        className="relative w-28 h-28 rounded-full bg-slate-950/65 border-2 border-slate-600/70 backdrop-blur-xs flex items-center justify-center shadow-xl cursor-grab active:cursor-grabbing"
      >
        <div
          className="w-11 h-11 rounded-full bg-sky-400/90 border-2 border-sky-200 shadow-md pointer-events-none transition-transform duration-75"
          style={{
            transform: `translate(${knob.x}px, ${knob.y}px)`,
          }}
        />
      </div>
    </div>
  );
};
