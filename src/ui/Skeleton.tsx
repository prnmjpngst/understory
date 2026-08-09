import React, { useEffect, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../theme/ThemeContext';

export interface SkeletonProps {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

// Shimmer block used for all loading states over ~200ms. Never a bare spinner.
export function Skeleton({ width, height, radius, style }: SkeletonProps) {
  const theme = useTheme();
  const { colors, radii } = theme;
  const progress = useSharedValue(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [progress]);

  const bandStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [-containerWidth, containerWidth],
        ),
      },
    ],
  }));

  return (
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      style={[
        {
          width,
          height,
          borderRadius: radius ?? radii.sm,
          backgroundColor: colors.skeletonBase,
          overflow: 'hidden',
        },
        style,
      ]}>
      {containerWidth > 0 ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: containerWidth,
            },
            bandStyle,
          ]}>
          <Svg width={containerWidth} height={height}>
            <Defs>
              <LinearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
                <Stop
                  offset="0"
                  stopColor={colors.skeletonBase}
                  stopOpacity="0"
                />
                <Stop
                  offset="0.5"
                  stopColor={colors.skeletonHighlight}
                  stopOpacity="1"
                />
                <Stop
                  offset="1"
                  stopColor={colors.skeletonBase}
                  stopOpacity="0"
                />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={containerWidth} height={height} fill="url(#shimmer)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

export interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonText({
  lines = 3,
  lineHeight = 14,
  gap = 10,
  style,
}: SkeletonTextProps) {
  const widths: `${number}%`[] = ['100%', '92%', '78%', '85%', '60%'];
  return (
    <View style={style}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={widths[i % widths.length]}
          height={lineHeight}
          style={i === 0 ? undefined : { marginTop: gap }}
        />
      ))}
    </View>
  );
}
