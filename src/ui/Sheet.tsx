import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeContext';
import { Text } from './Text';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  // Content below the sheet body, pinned above the safe area (e.g. action buttons).
  footer?: React.ReactNode;
}

const SPRING_IN = { damping: 28, stiffness: 240, mass: 0.7 };

export function Sheet({ visible, onClose, title, children, footer }: SheetProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(windowHeight);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = windowHeight;
      translateY.value = withSpring(0, SPRING_IN);
      return;
    }
    translateY.value = withTiming(windowHeight, { duration: 200 });
    const timer = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(timer);
  }, [visible, windowHeight, translateY]);

  const dismiss = () => {
    translateY.value = withTiming(windowHeight, { duration: 200 });
    onClose();
  };

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 900) {
        translateY.value = withTiming(windowHeight, { duration: 200 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, SPRING_IN);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, windowHeight], [1, 0]),
  }));

  if (!mounted) {
    return null;
  }

  return (
    <Modal
      transparent
      visible
      statusBarTranslucent
      animationType="none"
      onRequestClose={dismiss}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: colors.overlay,
              },
              backdropStyle,
            ]}>
            <Pressable
              accessibilityLabel="Dismiss"
              accessibilityRole="button"
              style={{ flex: 1 }}
              onPress={dismiss}
            />
          </Animated.View>
          <GestureDetector gesture={pan}>
            <Animated.View
              style={[
                {
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: radii.xl,
                  borderTopRightRadius: radii.xl,
                  paddingTop: spacing.sm,
                  paddingHorizontal: spacing.xl,
                  paddingBottom: insets.bottom + spacing.lg,
                  maxHeight: windowHeight * 0.85,
                },
                sheetStyle,
              ]}>
              <View
                style={{
                  alignSelf: 'center',
                  width: 36,
                  height: 4,
                  borderRadius: radii.pill,
                  backgroundColor: colors.borderStrong,
                  marginBottom: spacing.md,
                }}
              />
              {title ? (
                <Text variant="title2" style={{ marginBottom: spacing.md }}>
                  {title}
                </Text>
              ) : null}
              {children}
              {footer ? (
                <View style={{ marginTop: spacing.lg }}>{footer}</View>
              ) : null}
            </Animated.View>
          </GestureDetector>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
