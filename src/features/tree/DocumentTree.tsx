import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import HapticFeedback, {
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { DocumentNode } from '../../db/documents';
import { useTheme } from '../../theme';
import { Icon } from '../../ui';
import {
  buildBlockedMap,
  decideDropTarget,
  flattenTree,
  type DropTarget,
  type FlatRow,
  type GeomMap,
} from './dnd';

const ROW_HEIGHT = 46;
const INDENT_STEP = 18;
const BASE_INDENT = 14;
const EDGE_SCROLL_ZONE = 84;

interface DocumentTreeProps {
  nodes: DocumentNode[];
  expandedIds: Set<number>;
  onToggleExpand: (id: number) => void;
  onOpenDoc: (id: number) => void;
  onMore: (id: number) => void;
  onMove: (id: number, parentId: number | null, index: number) => Promise<void>;
  onExpandForDrop: (id: number) => void;
}

interface GhostState {
  top: number;
  left: number;
  title: string;
}

function TreeRow({
  row,
  blocked,
  dragging,
  dropInto,
  onPress,
  onMore,
}: {
  row: FlatRow;
  blocked: boolean;
  dragging: boolean;
  dropInto: boolean;
  onPress: () => void;
  onMore: () => void;
}) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const rotate = useSharedValue(row.expanded ? 90 : 0);

  useEffect(() => {
    rotate.value = withTiming(row.expanded ? 90 : 0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [row.expanded, rotate]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(160)}
      exiting={FadeOutUp.duration(110)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={row.title.length > 0 ? row.title : 'Untitled'}
        disabled={dragging || blocked}
        onPress={onPress}
        style={({ pressed }: { pressed: boolean }) => [
          {
            minHeight: ROW_HEIGHT,
            paddingLeft: BASE_INDENT + row.depth * INDENT_STEP,
            paddingRight: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: radii.sm,
            marginHorizontal: spacing.xs,
            backgroundColor: dropInto
              ? colors.accentSoft
              : pressed && !dragging
                ? colors.surfaceRaised
                : 'transparent',
            borderWidth: dropInto ? 1 : 0,
            borderColor: colors.accent,
          },
        ]}>
        {row.hasChildren ? (
          <Animated.View style={chevronStyle}>
            <Icon
              name="chevron-right"
              size={16}
              color={colors.textSecondary}
              strokeWidth={2.2}
            />
          </Animated.View>
        ) : (
          <Icon
            name="file-text"
            size={16}
            color={colors.textTertiary}
            strokeWidth={1.9}
          />
        )}
        <Animated.Text
          allowFontScaling
          maxFontSizeMultiplier={1.3}
          numberOfLines={1}
          style={[
            theme.text.body,
            {
              flex: 1,
              color: colors.textPrimary,
              marginLeft: 10,
              opacity: dragging ? 0.3 : 1,
            },
          ]}>
          {row.title.length > 0 ? row.title : 'Untitled'}
        </Animated.Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Menu untuk ${row.title}`}
          onPress={onMore}
          hitSlop={6}
          style={{ padding: 4, marginLeft: spacing.xs }}>
          <Icon name="ellipsis-vertical" size={16} color={colors.textTertiary} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export function DocumentTree({
  nodes,
  expandedIds,
  onToggleExpand,
  onOpenDoc,
  onMore,
  onMove,
  onExpandForDrop,
}: DocumentTreeProps) {
  const theme = useTheme();
  const { colors } = theme;

  const rows = useMemo(() => flattenTree(nodes, expandedIds), [nodes, expandedIds]);

  const scrollRef = useRef<ScrollView>(null);
  const geomRef = useRef<GeomMap>({});
  const rowsRef = useRef<FlatRow[]>(rows);
  rowsRef.current = rows;

  const geomSV = useSharedValue<GeomMap>({});
  const orderSV = useSharedValue<number[]>([]);
  const blockedSV = useSharedValue<Record<number, true>>({});
  const scrollYSV = useSharedValue(0);
  const containerTopSV = useSharedValue(0);
  const containerHeightSV = useSharedValue(0);
  const dySV = useSharedValue(0);
  const ghostTopSV = useSharedValue(0);
  const lastTargetKey = useSharedValue('');
  const dropLineYSV = useSharedValue(0);
  const targetSV = useSharedValue<DropTarget | null>(null);

  const [dragId, setDragId] = useState<number | null>(null);
  const [blockedMap, setBlockedMap] = useState<Record<number, true>>({});
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const dragIdRef = useRef<number | null>(null);
  dragIdRef.current = dragId;

  const syncGeom = useCallback(() => {
    orderSV.value = rowsRef.current.map((r) => r.id);
    geomSV.value = { ...geomRef.current };
  }, [geomSV, orderSV]);

  useEffect(() => {
    syncGeom();
  }, [rows, syncGeom]);

  const handleRowLayout = useCallback(
    (id: number, e: LayoutChangeEvent) => {
      const row = rowsRef.current.find((r) => r.id === id);
      if (!row) {
        return;
      }
      geomRef.current[id] = {
        y: e.nativeEvent.layout.y,
        h: e.nativeEvent.layout.height,
        depth: row.depth,
        hasChildren: row.hasChildren,
        childCount: row.childCount,
        parentId: row.parentId,
        index: row.index,
      };
      syncGeom();
    },
    [syncGeom],
  );

  // Auto-scroll saat jari mendekati tepi area pohon.
  useEffect(() => {
    if (dragId === null) {
      return;
    }
    const timer = setInterval(() => {
      const fingerY = ghostTopSV.value + dySV.value + ROW_HEIGHT / 2;
      const height = containerHeightSV.value;
      const offset = scrollYSV.value;
      let delta = 0;
      if (fingerY < EDGE_SCROLL_ZONE) {
        delta = -(EDGE_SCROLL_ZONE - fingerY) * 0.5;
      } else if (fingerY > height - EDGE_SCROLL_ZONE) {
        delta = (fingerY - (height - EDGE_SCROLL_ZONE)) * 0.5;
      }
      if (delta !== 0) {
        const next = Math.max(0, offset + delta);
        scrollRef.current?.scrollTo({ y: next, animated: false });
        scrollYSV.value = next;
      }
    }, 16);
    return () => clearInterval(timer);
  }, [dragId, ghostTopSV, dySV, scrollYSV, containerHeightSV]);

  const updateDropTarget = useCallback(
    (target: DropTarget | null) => {
      setDropTarget(target);
      targetSV.value = target;
      if (target) {
        const g = geomRef.current[target.rowId];
        if (g) {
          dropLineYSV.value = target.action === 'after' ? g.y + g.h : g.y;
        }
      }
    },
    [targetSV, dropLineYSV],
  );

  const endDrag = useCallback(
    (target: DropTarget | null) => {
      setGhost(null);
      setDragId(null);
      setBlockedMap({});
      setDropTarget(null);
      targetSV.value = null;
      dySV.value = 0;

      if (!target) {
        return;
      }
      HapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      if (target.action === 'into') {
        onExpandForDrop(target.rowId);
      }
      onMove(dragIdRef.current!, target.parentId, target.index).catch(
        () => {
          HapticFeedback.trigger('notificationWarning', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
        },
      );
    },
    [targetSV, dySV, onMove, onExpandForDrop],
  );

  const pan = Gesture.Pan()
    .activateAfterLongPress(280)
    .maxPointers(1)
    .onStart((e) => {
      const py = e.absoluteY - containerTopSV.value + scrollYSV.value;
      const order = orderSV.value;
      const geom = geomSV.value;
      let hit: number | null = null;
      for (let i = 0; i < order.length; i++) {
        const g = geom[order[i]];
        if (g && py >= g.y && py <= g.y + g.h) {
          hit = order[i];
          break;
        }
      }
      if (hit === null) {
        return;
      }
      const blocked = buildBlockedMap(hit, geom);
      blockedSV.value = blocked;
      const row = rowsRef.current.find((r) => r.id === hit);
      ghostTopSV.value = e.absoluteY - containerTopSV.value - ROW_HEIGHT / 2;
      dySV.value = 0;
      lastTargetKey.value = '';
      runOnJS(setBlockedMap)(blocked);
      runOnJS(setDragId)(hit);
      runOnJS(setGhost)({
        top: 0, // dipakai hanya sebagai penanda; transform dikendalikan ghostStyle
        left: BASE_INDENT + (row?.depth ?? 0) * INDENT_STEP,
        title: row?.title ?? 'Untitled',
      });
      runOnJS(HapticFeedback.trigger)(HapticFeedbackTypes.selection, {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    })
    .onUpdate((e) => {
      if (dragIdRef.current === null) {
        return;
      }
      dySV.value = e.translationY;
      const py = e.absoluteY - containerTopSV.value + scrollYSV.value;
      const target = decideDropTarget(
        py,
        dragIdRef.current,
        orderSV.value,
        geomSV.value,
        blockedSV.value,
      );
      const key = target ? `${target.action}:${target.rowId}` : '';
      if (key !== lastTargetKey.value) {
        lastTargetKey.value = key;
        runOnJS(updateDropTarget)(target);
      }
    })
    .onEnd(() => {
      if (dragIdRef.current === null) {
        return;
      }
      const target = targetSV.value;
      runOnJS(endDrag)(target);
    })
    .onFinalize(() => {
      if (dragIdRef.current === null) {
        return;
      }
      // Jika gesture dibatalkan (mis. kehilangan pointer), bersikan senyawa.
      runOnJS(endDrag)(targetSV.value);
    });

  const ghostStyle = useAnimatedStyle(() => ({
    top: ghostTopSV.value,
    transform: [{ translateY: dySV.value }],
  }));

  const dropLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dropLineYSV.value - scrollYSV.value }],
  }));

  const dragActive = dragId !== null;
  const intoRowId =
    dropTarget?.action === 'into' ? dropTarget.rowId : null;

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(e) => {
        containerTopSV.value = e.nativeEvent.layout.y;
        containerHeightSV.value = e.nativeEvent.layout.height;
      }}>
      <GestureDetector gesture={pan}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 6 }}
          onScroll={(e) => {
            scrollYSV.value = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled">
          <View>
            {rows.map((row) => (
              <View key={row.id} onLayout={(e) => handleRowLayout(row.id, e)}>
                <TreeRow
                  row={row}
                  blocked={dragActive && blockedMap[row.id] === true}
                  dragging={dragActive && dragId === row.id}
                  dropInto={intoRowId === row.id}
                  onPress={() => {
                    if (row.hasChildren) {
                      onToggleExpand(row.id);
                    } else {
                      onOpenDoc(row.id);
                    }
                  }}
                  onMore={() => onMore(row.id)}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </GestureDetector>

      {dragActive && dropTarget && dropTarget.action !== 'into' ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 6,
              right: 6,
              height: 2,
              borderRadius: 1,
              backgroundColor: colors.accent,
            },
            dropLineStyle,
          ]}
        />
      ) : null}

      {ghost && dragActive ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: ghost.left,
              height: ROW_HEIGHT,
              width: 240,
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: theme.radii.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              paddingHorizontal: 10,
              zIndex: 10,
            },
            ghostStyle,
          ]}>
          <Icon name="file-text" size={16} color={colors.textSecondary} strokeWidth={1.9} />
          <Animated.Text
            numberOfLines={1}
            style={[
              theme.text.body,
              {
                flex: 1,
                marginLeft: 10,
                color: colors.textPrimary,
              },
            ]}>
            {ghost.title}
          </Animated.Text>
        </Animated.View>
      ) : null}
    </View>
  );
}