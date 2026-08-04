import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, Card, Empty, Field, ui } from '@/components/UI';
import { colors } from '@/constants/theme';
import { useApp } from '@/store/AppContext';

export default function Jobs() {
  const { currentUser, jobs, users, addJob } = useApp();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

  if (!currentUser) return null;

  const visible =
    currentUser.role === 'admin'
      ? jobs
      : jobs.filter(
          (job) =>
            job.createdBy === currentUser.id ||
            job.workerIds.includes(currentUser.id),
        );

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert('확인', '작업명을 입력해주세요.');
      return;
    }

    const error = await addJob({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
    });
    if (error) {
      Alert.alert('등록 실패', error);
      return;
    }

    setTitle('');
    setDescription('');
    setLocation('');
    setOpen(false);
  };

  return (
    <>
      <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}>
          <View>
            <Text style={ui.title}>작업</Text>
            <Text style={ui.subtitle}>{visible.length}개의 작업</Text>
          </View>
          <Pressable onPress={() => setOpen(true)} style={styles.add}>
            <Text style={styles.addText}>＋ 등록</Text>
          </Pressable>
        </View>

        {visible.length ? (
          visible.map((job) => (
            <Pressable
              key={job.id}
              onPress={() => router.push(`/job/${job.id}`)}
            >
              <Card style={styles.job}>
                <View style={{ flex: 1, gap: 7 }}>
                  <View style={ui.row}>
                    <Text style={styles.jobTitle}>{job.title}</Text>
                    <Text style={ui.badge}>
                      {job.workerIds.length}명 배정
                    </Text>
                  </View>
                  {job.location ? (
                    <Text style={styles.meta}>⌖ {job.location}</Text>
                  ) : null}
                  {job.description ? (
                    <Text numberOfLines={2} style={styles.desc}>
                      {job.description}
                    </Text>
                  ) : null}
                  <Text style={styles.workers}>
                    {job.workerIds
                      .map((id) => users.find((user) => user.id === id)?.name)
                      .filter(Boolean)
                      .join(', ') || '배정된 작업자 없음'}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Card>
            </Pressable>
          ))
        ) : (
          <Empty
            title="등록된 작업이 없습니다"
            detail="첫 작업을 등록해주세요."
          />
        )}
      </ScrollView>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.title}>새 작업 등록</Text>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>
          <Card style={{ gap: 16 }}>
            <Field
              label="작업명 *"
              value={title}
              onChangeText={setTitle}
              placeholder="예: 2층 사무실 공사"
            />
            <Field
              label="현장 위치"
              value={location}
              onChangeText={setLocation}
              placeholder="주소 또는 장소"
            />
            <Field
              label="작업 설명"
              value={description}
              onChangeText={setDescription}
              placeholder="작업 내용을 입력하세요"
              multiline
              style={{
                height: 100,
                paddingTop: 14,
                textAlignVertical: 'top',
              }}
            />
            <Button title="작업 등록" onPress={submit} />
          </Card>
        </ScrollView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  add: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  addText: { color: '#fff', fontWeight: '700' },
  job: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  jobTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  meta: { color: colors.muted, fontSize: 13 },
  desc: { color: '#475467', lineHeight: 20 },
  workers: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  chevron: { fontSize: 26, color: '#98A2B3' },
  close: { color: colors.primary, fontWeight: '700', fontSize: 16 },
});
