import { createAdminClient } from '@/libs/supabase/admin';

/**
 * private 버킷(product-files)의 파일에 대해 일정 시간만 유효한 서명된 다운로드 URL을 발급한다.
 * service_role 클라이언트로 발급하므로 RLS와 무관하게 동작한다 — 호출부에서 구매 여부를
 * 반드시 먼저 검증해야 한다(hasPurchasedProduct 등).
 */
export async function createSignedDownloadUrl(
  filePath: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from('product-files')
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error('다운로드 URL 생성에 실패했습니다.');
  }

  return data.signedUrl;
}
