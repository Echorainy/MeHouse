import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { Icon, colors, s } from './ui';
import { isItemImageUri } from './item-image';

export function ItemImage({ uri, size = 36, color = colors.accent }: { uri?: string; size?: number; color?: string }) {
  const [failedUri, setFailedUri] = useState<string>();
  const failed = !!uri && (!isItemImageUri(uri) || failedUri === uri);
  return <View testID={uri && !failed ? 'item-image' : 'item-image-fallback'} accessibilityLabel={failed ? '图片加载失败，显示默认图标' : uri ? '物品图片' : '默认物品图标'} style={[s.itemImage, { width: size, height: size, flexShrink: 0, borderRadius: Math.min(16, size / 4) }]}>{uri && !failed ? <Image accessibilityIgnoresInvertColors source={{ uri }} onError={() => setFailedUri(uri)} resizeMode="contain" style={{ width: '100%', height: '100%' }} /> : <Icon name="package" color={color} />}</View>;
}
