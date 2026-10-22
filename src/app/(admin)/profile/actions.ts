'use server';

import { requireAdminPage } from '@/libs/supabase/queries/auth';
import { uploadAvatar, updateProfile } from '@/libs/supabase/queries/account';

/**
 * 반환하는 avatarUrl은 3가지 의미를 갖는다: undefined(변경 없음, 기존 값 유지),
 * null(제거됨), string(새 URL) — 호출부가 로컬 상태를 정확히 동기화하기 위해 구분한다.
 * File 객체는 Server Action 인자로 직접 전달할 수 없어(React가 plain object/FormData
 * 등 제한된 타입만 허용) FormData로 감싸서 받는다.
 */
export async function updateMyProfileAction(
  formData: FormData,
): Promise<{ avatarUrl: string | null | undefined }> {
  const user = await requireAdminPage();

  const fullName = formData.get('fullName') as string;
  const removeAvatar = formData.get('removeAvatar') === 'true';
  const avatarFile = formData.get('avatarFile');

  let avatarUrl: string | null | undefined;
  if (avatarFile instanceof File) {
    avatarUrl = await uploadAvatar(user.id, avatarFile);
  } else if (removeAvatar) {
    avatarUrl = null;
  }

  await updateProfile(user.id, { fullName, avatarUrl });
  return { avatarUrl };
}
