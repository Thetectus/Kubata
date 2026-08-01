import { Stage, Layer, Rect, Text, Group } from "react-konva";
import type Konva from "konva";
import { useProjectStore } from "../store/projectStore";

const PX_PER_METER = 30;
const STAGE_WIDTH = 640;
const STAGE_HEIGHT = 420;

export function Editor2D() {
  const divisions = useProjectStore((s) => s.project.divisions);
  const updateDivision = useProjectStore((s) => s.updateDivision);

  return (
    <Stage width={STAGE_WIDTH} height={STAGE_HEIGHT} style={{ background: "#f5f2ec", borderRadius: 8 }}>
      <Layer>
        {divisions.map((d) => (
          <Group
            key={d.id}
            x={d.x * PX_PER_METER}
            y={d.y * PX_PER_METER}
            draggable
            onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
              updateDivision(d.id, {
                x: round1(e.target.x() / PX_PER_METER),
                y: round1(e.target.y() / PX_PER_METER),
              });
            }}
          >
            <Rect
              width={d.width * PX_PER_METER}
              height={d.height * PX_PER_METER}
              fill="#e4c9a0"
              stroke="#8a5a2b"
              strokeWidth={2}
              cornerRadius={4}
            />
            <Text
              text={`${d.label}\n${d.width}m × ${d.height}m`}
              fontSize={12}
              padding={6}
              width={d.width * PX_PER_METER}
              align="center"
            />
            {/* alça de redimensionar: canto inferior direito */}
            <Rect
              x={d.width * PX_PER_METER - 8}
              y={d.height * PX_PER_METER - 8}
              width={16}
              height={16}
              fill="#8a5a2b"
              draggable
              onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
                const newWidthPx = Math.max(1 * PX_PER_METER, e.target.x() + 8);
                const newHeightPx = Math.max(1 * PX_PER_METER, e.target.y() + 8);
                updateDivision(d.id, {
                  width: round1(newWidthPx / PX_PER_METER),
                  height: round1(newHeightPx / PX_PER_METER),
                });
                // mantém a alça colada ao canto durante o arrasto
                e.target.position({ x: newWidthPx - 8, y: newHeightPx - 8 });
              }}
            />
          </Group>
        ))}
      </Layer>
    </Stage>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
