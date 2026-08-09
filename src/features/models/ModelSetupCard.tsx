import React, { useState } from 'react';
import { View } from 'react-native';

import {
  downloadModel,
  formatBytes,
  modelExists,
  modelFileSizeBytes,
  type ModelSpec,
} from '../../ai/models';
import { useAiStore } from '../../store/aiStore';
import { useTheme } from '../../theme';
import { Badge, Button, Icon, Text } from '../../ui';

interface ModelSetupCardProps {
  spec: ModelSpec;
  // Path aktif dari settings (bisa null bila belum dikonfigurasi).
  activePath: string | null;
  // Dipanggil setelah unduhan selesai dengan path file model.
  onInstalled: (path: string) => void;
  // Dipanggil saat pengguna menekan "Load model" (model sudah ada di disk).
  onLoad: () => void;
  // Status model dalam memori (untuk badge).
  ready: boolean;
  loading: boolean;
}

// Kartu pengaturan satu model: status + tombol unduh/progres.
export function ModelSetupCard({
  spec,
  activePath,
  onInstalled,
  onLoad,
  ready,
  loading,
}: ModelSetupCardProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;

  const downloading = useAiStore((s) => s.downloading.includes(spec.id));
  const progress = useAiStore((s) => s.downloads[spec.id]);
  const [error, setError] = useState<string | null>(null);
  const [installedSize, setInstalledSize] = useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    modelExists(spec).then((exists) => {
      if (exists) {
        modelFileSizeBytes(spec).then((bytes) => {
          if (!cancelled) {
            setInstalledSize(bytes);
          }
        });
      } else if (!cancelled) {
        setInstalledSize(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [spec, downloading]);

  const startDownload = async () => {
    setError(null);
    useAiStore.getState().startDownload(spec.id);
    try {
      await downloadModel(
        spec,
        (p) => useAiStore.getState().updateDownload(spec.id, p),
        (path) => {
          useAiStore.getState().finishDownload(spec.id);
          onInstalled(path);
        },
      );
    } catch (err) {
      useAiStore.getState().finishDownload(spec.id);
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const installed = activePath !== null || installedSize !== null;

  const fraction = progress ? progress.fraction : 0;

  return (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: radii.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radii.md,
            backgroundColor: colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon
            name={spec.kind === 'chat' ? 'message-circle' : 'cpu'}
            size={19}
            color={colors.accent}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="callout" style={{ fontFamily: theme.fonts.uiMedium }}>
            {spec.name}
          </Text>
          <Text variant="footnote" color="textTertiary" style={{ marginTop: 2 }}>
            {installedSize !== null
              ? `${formatBytes(installedSize)} · installed`
              : `~${spec.sizeHintMb} MB download`}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
            {ready ? (
              <Badge label="Loaded" tone="success" icon="check" />
            ) : loading ? (
              <Badge label="Loading…" tone="warning" icon="cpu" />
            ) : installed && !downloading ? (
              <Badge label="Installed" tone="accent" />
            ) : downloading ? (
              <Badge
                label={`${Math.round(fraction * 100)}%`}
                tone="warning"
              />
            ) : (
              <Badge label="Not installed" tone="neutral" />
            )}
          </View>

          {error ? (
            <Text variant="footnote" color="danger" style={{ marginTop: spacing.sm }}>
              {error}
            </Text>
          ) : null}

          {downloading ? (
            <View
              style={{
                marginTop: spacing.sm,
                height: 6,
                borderRadius: radii.pill,
                backgroundColor: colors.surfaceRaised,
                overflow: 'hidden',
              }}>
              <View
                style={{
                  width: `${Math.max(2, Math.round(fraction * 100))}%`,
                  height: '100%',
                  backgroundColor: colors.accent,
                }}
              />
            </View>
          ) : null}

          <View style={{ marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm }}>
            {!installed ? (
              <Button
                title="Download"
                size="sm"
                icon="download"
                onPress={startDownload}
                disabled={downloading}
              />
            ) : ready ? null : (
              <Button
                title="Load model"
                size="sm"
                icon="cpu"
                onPress={onLoad}
              />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}