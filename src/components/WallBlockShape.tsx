import { useEffect, useRef } from "react";
import { Rect } from "react-konva";
import KonvaLib from "konva";

interface Props {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  animate: boolean;
  delayMs: number;
}

/** Um único bloco/tijolo desenhado na parede. Anima a entrada (fade+scale)
 * quando é novo, para o utilizador ver a parede "a ser construída" em vez
 * de a quantidade mudar num piscar de olhos. */
export function WallBlockShape({ x, y, width, height, fill, animate, delayMs }: Props) {
  const ref = useRef<KonvaLib.Rect>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!animate) {
      node.opacity(1);
      return;
    }
    node.opacity(0);
    const tween = new KonvaLib.Tween({
      node,
      opacity: 1,
      duration: 0.18,
      delay: delayMs / 1000,
      easing: KonvaLib.Easings.EaseOut,
    });
    tween.play();
    return () => tween.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Rect
      ref={ref}
      x={x}
      y={y}
      width={width}
      height={height}
      fill={fill}
      stroke="#6b4423"
      strokeWidth={0.6}
      cornerRadius={1}
    />
  );
}
