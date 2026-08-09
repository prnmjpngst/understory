import React from 'react';
import Svg, {
  Circle,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
} from 'react-native-svg';

import { iconGlyphs } from './iconGlyphs.generated';

export type IconName = keyof typeof iconGlyphs;

export interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  // Stroke weight at 24px; scales proportionally with size for optical consistency.
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color, strokeWidth = 2 }: IconProps) {
  const glyphs = iconGlyphs[name];
  const effectiveStroke = strokeWidth * (size / 24);
  const common = {
    stroke: color,
    strokeWidth: effectiveStroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {glyphs.map((g, index) => {
        switch (g.tag) {
          case 'path':
            return <Path key={index} d={String(g.props.d)} {...common} />;
          case 'circle':
            return (
              <Circle
                key={index}
                cx={Number(g.props.cx)}
                cy={Number(g.props.cy)}
                r={Number(g.props.r)}
                {...common}
              />
            );
          case 'line':
            return (
              <Line
                key={index}
                x1={Number(g.props.x1)}
                y1={Number(g.props.y1)}
                x2={Number(g.props.x2)}
                y2={Number(g.props.y2)}
                {...common}
              />
            );
          case 'rect':
            return (
              <Rect
                key={index}
                x={Number(g.props.x)}
                y={Number(g.props.y)}
                width={Number(g.props.width)}
                height={Number(g.props.height)}
                rx={
                  g.props.rx !== undefined ? Number(g.props.rx) : undefined
                }
                {...common}
              />
            );
          case 'polyline':
            return (
              <Polyline
                key={index}
                points={String(g.props.points)}
                {...common}
              />
            );
          case 'polygon':
            return (
              <Polygon
                key={index}
                points={String(g.props.points)}
                {...common}
              />
            );
          default:
            return null;
        }
      })}
    </Svg>
  );
}
