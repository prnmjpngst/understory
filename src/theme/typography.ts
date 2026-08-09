import type { TextStyle } from 'react-native';

// Inter for UI chrome, Lora for note content. Files live in assets/fonts and are
// linked into android/app/src/main/assets/fonts (fontFamily = filename on Android).
export const fontFamily = {
  uiRegular: 'Inter-Regular',
  uiMedium: 'Inter-Medium',
  uiSemiBold: 'Inter-SemiBold',
  uiBold: 'Inter-Bold',
  contentRegular: 'Lora-Regular',
  contentItalic: 'Lora-Italic',
  contentMedium: 'Lora-Medium',
  contentSemiBold: 'Lora-SemiBold',
  contentBold: 'Lora-Bold',
} as const;

export type TextVariant =
  | 'title1'
  | 'title2'
  | 'headline'
  | 'body'
  | 'callout'
  | 'footnote'
  | 'caption'
  | 'contentTitle'
  | 'contentBody'
  | 'contentSmall';

export const textVariants: Record<TextVariant, TextStyle> = {
  title1: {
    fontFamily: fontFamily.uiBold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  title2: {
    fontFamily: fontFamily.uiSemiBold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  headline: {
    fontFamily: fontFamily.uiSemiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontFamily: fontFamily.uiRegular,
    fontSize: 15,
    lineHeight: 22,
  },
  callout: {
    fontFamily: fontFamily.uiRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  footnote: {
    fontFamily: fontFamily.uiRegular,
    fontSize: 12.5,
    lineHeight: 17,
  },
  caption: {
    fontFamily: fontFamily.uiMedium,
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 0.3,
  },
  contentTitle: {
    fontFamily: fontFamily.contentSemiBold,
    fontSize: 23,
    lineHeight: 31,
  },
  // Reading-optimized: ~1.6 line-height.
  contentBody: {
    fontFamily: fontFamily.contentRegular,
    fontSize: 16.5,
    lineHeight: 27,
  },
  contentSmall: {
    fontFamily: fontFamily.contentRegular,
    fontSize: 14,
    lineHeight: 22,
  },
};
