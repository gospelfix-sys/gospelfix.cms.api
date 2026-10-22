import { createAdminClient } from '@/libs/supabase/admin';

export interface AuthApiConfig {
  id: string;
  endpoint_slug: string;
  label: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * slug에 해당하는 auth API 활성화 여부를 조회한다.
 * 마이그레이션 미적용 등으로 row가 아예 없으면(null) 항상 허용(fail-open)한다 —
 * 회원가입/로그인은 main 앱이 상시 의존하는 핵심 플로우라, 설정 누락이
 * 곧바로 전체 장애로 이어지는 fail-closed보다 안전한 기본값이다.
 */
export async function getAuthApiConfigBySlug(
  slug: string,
): Promise<AuthApiConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('auth_api_configs')
    .select('id, endpoint_slug, label, is_enabled, created_at, updated_at')
    .eq('endpoint_slug', slug)
    .single();
  if (error) console.error('[auth-api-configs] getAuthApiConfigBySlug:', error);
  if (error || !data) return null;
  return data as AuthApiConfig;
}

export async function getAllAuthApiConfigs(): Promise<AuthApiConfig[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('auth_api_configs')
    .select('id, endpoint_slug, label, is_enabled, created_at, updated_at')
    .order('created_at', { ascending: true });
  if (error) console.error('[auth-api-configs] getAllAuthApiConfigs:', error);
  if (error || !data) return [];
  return data as AuthApiConfig[];
}

export async function toggleAuthApiConfig(
  id: string,
  isEnabled: boolean,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('auth_api_configs')
    .update({ is_enabled: isEnabled })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
