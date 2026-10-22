import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getQuoteByIdAdmin } from '@/libs/supabase/queries/quotes.admin';
import { parseUserAgent, formatTrafficSource } from '@/libs/user-agent';
import { formatPrice, isSafeHttpUrl } from '@/libs/format';

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">
        {title}
      </h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {children}
      </dl>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-gray-400 mb-0.5">{label}</dt>
      <dd
        className={`text-sm text-gray-900 dark:text-gray-100 break-words ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value === null || value === undefined || value === '' ? '-' : value}
      </dd>
    </div>
  );
}

export default async function QuoteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const quote = await getQuoteByIdAdmin(params.id);
  if (!quote) notFound();

  const { browser, os } = parseUserAgent(quote.user_agent);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/quotes"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-2"
        >
          <ArrowLeft size={14} />
          목록으로
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          {quote.contact_name}님의 견적 신청
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {new Date(quote.created_at).toLocaleString('ko-KR')}
        </p>
      </div>

      <div className="space-y-4">
        <Card title="방문 정보">
          <Field
            label="신청일시"
            value={new Date(quote.created_at).toLocaleString('ko-KR')}
          />
          <Field
            label="로그인 여부"
            value={quote.is_authenticated ? '로그인 상태' : '비로그인'}
          />
          <Field label="브라우저 / OS" value={`${browser} · ${os}`} />
          <Field label="IP 주소" value={quote.ip_address} mono />
          <Field
            label="유입경로"
            value={formatTrafficSource(quote.referer, quote.utm_params)}
          />
          <Field label="Referer 원본" value={quote.referer} mono />
          {quote.utm_params && Object.keys(quote.utm_params).length > 0 && (
            <Field
              label="UTM 파라미터"
              value={Object.entries(quote.utm_params)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ')}
              mono
            />
          )}
          <div className="sm:col-span-2">
            <dt className="text-xs text-gray-400 mb-0.5">User-Agent 원본</dt>
            <dd className="text-xs font-mono text-gray-500 dark:text-gray-400 break-all">
              {quote.user_agent ?? '-'}
            </dd>
          </div>
        </Card>

        <Card title="연락처">
          <Field label="담당자명" value={quote.contact_name} />
          <Field label="연락처" value={quote.contact_value} />
          <Field label="이메일" value={quote.contact_email} />
          <Field label="사업자번호" value={quote.business_number} />
        </Card>

        <Card title="견적 내용">
          <Field label="예상견적" value={formatPrice(quote.estimated_total)} />
          <Field label="희망 일정" value={quote.schedule} />
          <Field label="타겟 연령대" value={quote.target_age} />
          <Field label="업종" value={quote.shop_industry} />
          <Field label="쇼핑몰 운영 현황" value={quote.shop_status} />
          <Field label="제작 범위" value={quote.production_scope} />
          <Field
            label="시스템 개발 필요 여부"
            value={quote.needs_system_dev ? '필요' : '불필요'}
          />
          <Field
            label="선택 카테고리"
            value={quote.selected_categories?.join(', ')}
          />
          <Field
            label="스타일 선호"
            value={quote.style_preferences?.join(', ')}
          />
          <Field
            label="필수 기능"
            value={quote.required_features?.join(', ')}
          />
          {quote.selected_items && quote.selected_items.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-gray-400 mb-1">선택 항목</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">
                <ul className="space-y-1">
                  {quote.selected_items.map((item) => (
                    <li key={item.id}>
                      {item.id} × {item.quantity}
                      {item.withCopywriting ? ' (카피라이팅 포함)' : ''}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          {quote.reference_urls && quote.reference_urls.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-gray-400 mb-1">레퍼런스 URL</dt>
              <dd className="text-sm space-y-1">
                {quote.reference_urls.map((url) =>
                  isSafeHttpUrl(url) ? (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      {url}
                    </a>
                  ) : (
                    <span
                      key={url}
                      className="block text-gray-400 break-all"
                      title="안전하지 않은 URL 형식이라 링크로 열지 않습니다"
                    >
                      {url}
                    </span>
                  ),
                )}
              </dd>
            </div>
          )}
          {quote.project_summary && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-gray-400 mb-1">프로젝트 요약</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                {quote.project_summary}
              </dd>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
