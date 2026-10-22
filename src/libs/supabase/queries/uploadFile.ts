import { createClient } from '@/libs/supabase/client';

/**
 * Supabase Storage 공용 업로드 유틸.
 *
 * 기존에 ProductForm/PortfolioForm/PostForm이 각자 들고 있던 업로드 함수를 하나로 합친 것이다.
 * 버킷 이름과 폴더는 폼마다 다르므로 인자로 받는다(folder 미지정 시 버킷 루트에 업로드).
 */
export async function uploadFile(
  file: File,
  bucket: string,
  folder?: string,
): Promise<{ path: string; publicUrl: string }> {
  const supabase = createClient();
  const ext = file.name.split('.').pop();
  // 동일 밀리초에 여러 장을 병렬 업로드해도 경로가 겹치지 않도록 랜덤 접미사를 붙인다.
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = folder ? `${folder}/${filename}` : filename;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false });
  if (error) throw new Error(`파일 업로드 실패: ${error.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return { path: data.path, publicUrl };
}
