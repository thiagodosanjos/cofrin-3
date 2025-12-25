import React from 'react';
import { Text, TextProps, StyleProp, TextStyle } from 'react-native';
import useResponsiveFont from '../hooks/useResponsiveFont';
import { Variant } from '../theme/typography';

interface Props extends TextProps {
  variant?: Variant;
  style?: StyleProp<TextStyle>;
}

export default function ResponsiveText({ variant = 'body', style, children, ...rest }: Props) {
  const { getStyle } = useResponsiveFont();
  const responsive = getStyle(variant);

  return (
    <Text style={[responsive as any, style]} {...rest}>
      {children}
    </Text>
  );
}
