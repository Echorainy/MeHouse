import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

export const ITEM_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type PickItemImageResult = { canceled: true } | { canceled: false; uri: string };

function extensionFor(mimeType?: string, uri?: string) {
  const fromMime = mimeType?.split('/')[1]?.replace('jpeg', 'jpg');
  if (fromMime && /^[a-z0-9]+$/i.test(fromMime)) return fromMime;
  const fromUri = uri?.split('?')[0].split('.').pop();
  return fromUri && /^[a-z0-9]+$/i.test(fromUri) ? fromUri : 'jpg';
}

async function webDataUri(uri: string, mimeType?: string, fileSize?: number) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const size = fileSize ?? blob.size;
  if (size > ITEM_IMAGE_MAX_BYTES) throw new Error('图片不能超过 5 MB');
  const type = mimeType || blob.type;
  if (!IMAGE_TYPES.has(type)) throw new Error('请选择 JPG、PNG、WebP 或 GIF 图片');
  const source = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new globalThis.Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('无法读取图片，请选择有效图片'));
      image.src = source;
    });
    const scale = Math.min(1, 768 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法处理图片，请重试');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/webp', 0.8);
    if (data.length > 350000) throw new Error('图片内容过大，请选择较小的图片');
    return data;
  } finally { URL.revokeObjectURL(source); }
}

export async function pickItemImage(): Promise<PickItemImageResult> {
  const permission = Platform.OS === 'web' ? null : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission && !permission.granted) throw new Error('需要允许访问照片才能添加物品图片');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 }).catch(() => { throw new Error('无法选择图片，请选择 JPG、PNG、WebP 或 GIF 图片后重试'); });
  if (result.canceled || !result.assets?.[0]) return { canceled: true };
  const asset = result.assets[0];
  if (Platform.OS === 'web') {
    try { return { canceled: false, uri: await webDataUri(asset.uri, asset.mimeType, asset.fileSize) }; }
    finally { if (asset.uri.startsWith('blob:')) URL.revokeObjectURL(asset.uri); }
  }
  if (asset.fileSize && asset.fileSize > ITEM_IMAGE_MAX_BYTES) throw new Error('图片不能超过 5 MB');
  if (!asset.width || !asset.height) throw new Error('无法读取图片，请选择有效图片');
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error('当前设备不支持本地图片保存');
  const target = `${root}item-image-${Date.now()}-${Math.random().toString(36).slice(2)}.${extensionFor(asset.mimeType, asset.uri)}`;
  try { await FileSystem.copyAsync({ from: asset.uri, to: target }); }
  catch { await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined); throw new Error('图片保存失败，请检查设备空间并重试'); }
  return { canceled: false, uri: target };
}

export async function removeItemImage(uri?: string) {
  if (!uri || Platform.OS === 'web' || !FileSystem.documentDirectory || !uri.startsWith(`${FileSystem.documentDirectory}item-image-`) || uri.slice(FileSystem.documentDirectory.length).includes('/')) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export function isItemImageUri(uri?: string) {
  return typeof uri === 'string' && (uri.startsWith('data:image/') || uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('http://') || uri.startsWith('https://'));
}
