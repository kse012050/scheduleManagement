import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, Card, Empty, ui } from '@/components/UI';
import { colors } from '@/constants/theme';
import { formatDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { Schedule, User } from '@/types';

const PHOTO_BUCKET = 'schedule-images';

type PhotoRow = {
  id: string;
  schedule_id: string;
  work_date: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
};

type SchedulePhoto = PhotoRow & { signedUrl: string };

type SchedulePhotoModalProps = {
  visible: boolean;
  schedule: Schedule | null;
  workDate: string | null;
  currentUser: User;
  users: User[];
  onClose: () => void;
  onEditSchedule?: (schedule: Schedule) => void;
};

const uploadErrorMessage = (message: string) => {
  if (
    message.includes('schedule_images') ||
    message.includes('schedule-images')
  ) {
    return '사진 저장소가 아직 설정되지 않았습니다. Supabase 사진 기능 SQL을 먼저 실행해주세요.';
  }
  return '사진을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.';
};

export function SchedulePhotoModal({
  visible,
  schedule,
  workDate,
  currentUser,
  users,
  onClose,
  onEditSchedule,
}: SchedulePhotoModalProps) {
  const [photos, setPhotos] = useState<SchedulePhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const canUpload =
    currentUser.role === 'worker' &&
    !!schedule?.workerId &&
    schedule.workerId === currentUser.id;

  const loadPhotos = async () => {
    if (!schedule || !workDate) return;

    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('schedule_images')
      .select(
        'id, schedule_id, work_date, storage_path, original_name, mime_type, uploaded_by, created_at',
      )
      .eq('schedule_id', schedule.id)
      .eq('work_date', workDate)
      .order('created_at', { ascending: false });

    if (queryError) {
      setPhotos([]);
      setError(uploadErrorMessage(queryError.message));
      setLoading(false);
      return;
    }

    const rows = data as PhotoRow[];
    const withUrls = await Promise.all(
      rows.map(async (photo) => {
        const { data: signedData, error: signedError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .createSignedUrl(photo.storage_path, 60 * 60);
        return {
          ...photo,
          signedUrl: signedError ? '' : signedData.signedUrl,
        };
      }),
    );
    setPhotos(withUrls);
    setLoading(false);
  };

  useEffect(() => {
    if (!visible) return;
    setPendingDeleteId(null);
    void loadPhotos();
  }, [visible, schedule?.id, workDate]);

  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!schedule || !workDate) return null;
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
      return '사진 한 장의 크기는 10MB 이하여야 합니다.';
    }

    const fileResponse = await fetch(asset.uri);
    const fileData = await fileResponse.arrayBuffer();
    const rawExtension = asset.fileName?.split('.').pop()?.toLowerCase();
    const mimeExtension = asset.mimeType?.split('/').pop()?.toLowerCase();
    const extension =
      rawExtension && /^[a-z0-9]+$/.test(rawExtension)
        ? rawExtension
        : mimeExtension && /^[a-z0-9]+$/.test(mimeExtension)
          ? mimeExtension
          : 'jpg';
    const uniqueName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}.${extension}`;
    const storagePath = `${schedule.id}/${workDate}/${currentUser.id}/${uniqueName}`;
    const mimeType = asset.mimeType ?? 'image/jpeg';

    const { error: storageError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, fileData, {
        contentType: mimeType,
        upsert: false,
      });
    if (storageError) return uploadErrorMessage(storageError.message);

    const { error: insertError } = await supabase
      .from('schedule_images')
      .insert({
        schedule_id: schedule.id,
        work_date: workDate,
        storage_path: storagePath,
        original_name: asset.fileName ?? uniqueName,
        mime_type: mimeType,
        uploaded_by: currentUser.id,
      });
    if (insertError) {
      await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
      return uploadErrorMessage(insertError.message);
    }

    return null;
  };

  const selectImages = async (source: 'camera' | 'library') => {
    if (!canUpload || uploading) return;

    setError('');
    if (Platform.OS !== 'web') {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(
          source === 'camera'
            ? '사진 촬영을 위해 카메라 권한을 허용해주세요.'
            : '사진 선택을 위해 사진 보관함 권한을 허용해주세요.',
        );
        return;
      }
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsMultipleSelection: true,
            selectionLimit: 10,
          });
    if (result.canceled) return;

    setUploading(true);
    try {
      for (const asset of result.assets) {
        const uploadError = await uploadAsset(asset);
        if (uploadError) {
          setError(uploadError);
          break;
        }
      }
      await loadPhotos();
    } catch {
      setError('사진 파일을 읽거나 저장하지 못했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photo: SchedulePhoto) => {
    if (!canUpload || pendingDeleteId !== photo.id) return;

    setError('');
    const { error: storageError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove([photo.storage_path]);
    if (storageError) {
      setError('사진 파일을 삭제하지 못했습니다.');
      return;
    }

    const { error: deleteError } = await supabase
      .from('schedule_images')
      .delete()
      .eq('id', photo.id);
    if (deleteError) {
      setError('사진 정보를 삭제하지 못했습니다.');
      return;
    }

    setPendingDeleteId(null);
    setPhotos((previous) => previous.filter((item) => item.id !== photo.id));
  };

  const close = () => {
    setError('');
    setPendingDeleteId(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={ui.title}>작업 사진</Text>
            <Text style={styles.subtitle}>
              {schedule?.title ?? ''} · {workDate ? formatDate(workDate) : ''}
            </Text>
          </View>
          <Pressable onPress={close}>
            <Text style={styles.close}>닫기</Text>
          </Pressable>
        </View>

        {canUpload ? (
          <View style={styles.uploadActions}>
            <View style={styles.uploadAction}>
              <Button
                title="카메라 촬영"
                onPress={() => void selectImages('camera')}
                disabled={uploading}
              />
            </View>
            <View style={styles.uploadAction}>
              <Button
                title="사진 선택"
                kind="secondary"
                onPress={() => void selectImages('library')}
                disabled={uploading}
              />
            </View>
          </View>
        ) : null}

        {currentUser.role === 'admin' && schedule && onEditSchedule ? (
          <Button
            title="일정 정보 수정"
            kind="secondary"
            onPress={() => {
              close();
              onEditSchedule(schedule);
            }}
          />
        ) : null}

        {uploading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>사진을 저장하고 있습니다...</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={ui.sectionTitle}>이 날짜의 사진</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : photos.length ? (
          <View style={styles.photoGrid}>
            {photos.map((photo) => (
              <Card key={photo.id} style={styles.photoCard}>
                {photo.signedUrl ? (
                  <Image
                    source={{ uri: photo.signedUrl }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.photo, styles.photoUnavailable]}>
                    <Text style={styles.photoUnavailableText}>
                      사진을 불러오지 못했습니다.
                    </Text>
                  </View>
                )}
                <Text numberOfLines={1} style={styles.fileName}>
                  {photo.original_name}
                </Text>
                <Text style={styles.meta}>
                  {users.find((user) => user.id === photo.uploaded_by)?.name ??
                    '작업자'}
                </Text>
                {canUpload && photo.uploaded_by === currentUser.id ? (
                  pendingDeleteId === photo.id ? (
                    <View style={styles.deleteActions}>
                      <Pressable onPress={() => setPendingDeleteId(null)}>
                        <Text style={styles.cancelDelete}>취소</Text>
                      </Pressable>
                      <Pressable onPress={() => void deletePhoto(photo)}>
                        <Text style={styles.confirmDelete}>삭제 확인</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable onPress={() => setPendingDeleteId(photo.id)}>
                      <Text style={styles.delete}>삭제</Text>
                    </Pressable>
                  )
                ) : null}
              </Card>
            ))}
          </View>
        ) : (
          <Empty
            title="등록된 사진이 없습니다"
            detail={
              canUpload
                ? '카메라로 촬영하거나 사진을 선택해 등록해주세요.'
                : '작업자가 사진을 등록하면 이곳에서 확인할 수 있습니다.'
            }
          />
        )}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: colors.muted, fontSize: 14 },
  close: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  uploadActions: { flexDirection: 'row', gap: 10 },
  uploadAction: { flex: 1 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  loadingText: { color: colors.muted, fontSize: 13 },
  error: {
    color: colors.danger,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    lineHeight: 19,
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoCard: { width: 220, maxWidth: '100%', gap: 8, padding: 10 },
  photo: { width: '100%', height: 165, borderRadius: 12 },
  photoUnavailable: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  photoUnavailableText: { color: colors.muted, fontSize: 12 },
  fileName: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12 },
  delete: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  deleteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  cancelDelete: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  confirmDelete: { color: colors.danger, fontSize: 13, fontWeight: '800' },
});
