"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Zone } from "@drip-tv/shared";
import { useBuilderStore } from "@/lib/builder/store";

function clampPct(v: number, max = 100) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(max, v));
}

function ZoneContentPreview({ zone }: { zone: Zone }) {
  const c = zone.content;
  const fitClass =
    zone.fit === "contain"
      ? "object-contain"
      : zone.fit === "stretch"
        ? "object-fill"
        : "object-cover";

  switch (c.kind) {
    case "text":
      return (
        <div
          className="flex h-full w-full items-center justify-center p-2"
          style={{
            color: c.color,
            fontSize: c.fontSize,
            textAlign: c.align,
            justifyContent:
              c.align === "left" ? "flex-start" : c.align === "right" ? "flex-end" : "center",
          }}
        >
          <span className="break-words">{c.text || "Text"}</span>
        </div>
      );
    case "clock":
      return (
        <div className="flex h-full w-full items-center justify-center font-display text-3xl text-white">
          <span>00:00</span>
        </div>
      );
    case "media":
      return (
        <div className={`flex h-full w-full items-center justify-center bg-black/40 ${fitClass}`}>
          <span className="font-heading uppercase tracking-[1px] text-white/70">Media</span>
        </div>
      );
    case "playlist":
      return (
        <div className="flex h-full w-full items-center justify-center bg-paua/40">
          <span className="font-heading uppercase tracking-[1px] text-white/70">Playlist</span>
        </div>
      );
    case "widget":
      return (
        <div className="flex h-full w-full items-center justify-center bg-sapphire/40">
          <span className="font-heading uppercase tracking-[1px] text-white/80">Widget</span>
        </div>
      );
    default:
      return null;
  }
}

function DraggableZone({
  zone,
  selected,
  containerSize,
}: {
  zone: Zone;
  selected: boolean;
  containerSize: { width: number; height: number };
}) {
  const selectZone = useBuilderStore((s) => s.selectZone);
  const updateZone = useBuilderStore((s) => s.updateZone);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `zone-${zone.id}`,
    data: { zoneId: zone.id },
  });

  const tx = transform?.x ?? 0;
  const ty = transform?.y ?? 0;

  // We render position from zone.x/zone.y (percent) and overlay transform deltas while dragging.
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${zone.x}%`,
    top: `${zone.y}%`,
    width: `${zone.w}%`,
    height: `${zone.h}%`,
    zIndex: zone.z,
    background: zone.background ?? undefined,
    transform: transform ? `translate3d(${tx}px, ${ty}px, 0)` : undefined,
    cursor: isDragging ? "grabbing" : "grab",
  };

  function onResize(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = zone.w;
    const startH = zone.h;
    const { width: cw, height: ch } = containerSize;

    function onMove(ev: PointerEvent) {
      const dxPct = cw > 0 ? ((ev.clientX - startX) / cw) * 100 : 0;
      const dyPct = ch > 0 ? ((ev.clientY - startY) / ch) * 100 : 0;
      updateZone(zone.id, {
        w: clampPct(startW + dxPct, 100 - zone.x),
        h: clampPct(startH + dyPct, 100 - zone.y),
      });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        selectZone(zone.id);
      }}
      className={`overflow-hidden rounded-sm ring-1 ring-white/10 ${selected ? "outline outline-2 outline-aqua" : ""}`}
    >
      <ZoneContentPreview zone={zone} />
      {selected && (
        <div
          onPointerDown={onResize}
          className="absolute -right-1 -bottom-1 h-3 w-3 cursor-nwse-resize rounded-sm bg-aqua ring-1 ring-white"
          aria-label="Resize zone"
        />
      )}
    </div>
  );
}

export function Canvas() {
  const display = useBuilderStore((s) => s.display);
  const selectedZoneId = useBuilderStore((s) => s.selectedZoneId);
  const selectZone = useBuilderStore((s) => s.selectZone);
  const updateZone = useBuilderStore((s) => s.updateZone);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const aspectClass = display.aspect_ratio === "9:16" ? "aspect-[9/16]" : "aspect-[16/9]";

  function onDragEnd(event: DragEndEvent) {
    const zoneId = (event.active.data.current as { zoneId?: string } | undefined)?.zoneId;
    if (!zoneId) return;
    const zone = display.zones.find((z) => z.id === zoneId);
    if (!zone) return;
    const { width, height } = containerSize;
    if (width <= 0 || height <= 0) return;
    const dxPct = (event.delta.x / width) * 100;
    const dyPct = (event.delta.y / height) * 100;
    updateZone(zoneId, {
      x: clampPct(zone.x + dxPct, 100 - zone.w),
      y: clampPct(zone.y + dyPct, 100 - zone.h),
    });
  }

  function measure() {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-athens p-6">
      <div className="w-full max-w-5xl">
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div
            ref={(node) => {
              containerRef.current = node;
              if (node) {
                const rect = node.getBoundingClientRect();
                if (
                  rect.width !== containerSize.width ||
                  rect.height !== containerSize.height
                ) {
                  setContainerSize({ width: rect.width, height: rect.height });
                }
              }
            }}
            onLoad={measure}
            onClick={() => selectZone(null)}
            className={`relative w-full overflow-hidden rounded-lg shadow-lg ${aspectClass}`}
            style={{ background: display.background.color }}
          >
            {display.zones.map((zone) => (
              <DraggableZone
                key={zone.id}
                zone={zone}
                selected={selectedZoneId === zone.id}
                containerSize={containerSize}
              />
            ))}
          </div>
        </DndContext>
        <p className="mt-3 text-center font-heading text-h5 uppercase tracking-[1px] text-ink/50">
          {display.aspect_ratio} preview
        </p>
      </div>
    </div>
  );
}
