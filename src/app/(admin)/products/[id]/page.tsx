import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getProductByIdAdmin } from '@/libs/supabase/queries/products.admin';
import { getProfileById } from '@/libs/supabase/queries/account';
import { getProductCategoryLabelMap } from '@/libs/supabase/queries/product-categories.admin';
import { getProductSubCategoryLabelMap } from '@/libs/supabase/queries/product-sub-categories.admin';
import { formatPrice, isSafeHttpUrl } from '@/libs/format';
import ProductReviewActions from './ProductReviewActions';
import type { Product } from '@/types/product';

const STATUS_LABEL: Record<Product['status'], string> = {
  draft: '초안',
  pending: '검수 대기',
  approved: '승인됨',
  rejected: '반려됨',
};

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

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [product, categoryLabels, subCategoryLabels] = await Promise.all([
    getProductByIdAdmin(params.id),
    getProductCategoryLabelMap(),
    getProductSubCategoryLabelMap(),
  ]);
  if (!product) notFound();

  const seller = product.seller_id
    ? await getProfileById(product.seller_id)
    : null;
  const submitterLabel = product.seller_id
    ? seller
      ? `${seller.full_name ?? seller.email} (${seller.email})`
      : '알 수 없음'
    : 'GospelFix 공식';

  const hasDiscountPeriod =
    product.discount_starts_at || product.discount_ends_at;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-2"
        >
          <ArrowLeft size={14} />
          목록으로
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          {product.name}
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {new Date(product.created_at).toLocaleString('ko-KR')} 등록
        </p>
      </div>

      <div className="space-y-4">
        <ProductReviewActions productId={product.id} status={product.status} />

        <Card title="기본 정보">
          <Field label="상품명" value={product.name} />
          <Field label="슬러그" value={product.slug} mono />
          <Field
            label="카테고리"
            value={product.category ? (categoryLabels[product.category] ?? product.category) : null}
          />
          <Field
            label="소분류"
            value={product.sub_categories
              .map((v) => subCategoryLabels[v] ?? v)
              .join(', ')}
          />
          <Field label="상품 코드" value={product.product_code} mono />
          <Field label="디자인 방식" value={product.design_type} />
          <Field label="판매가" value={formatPrice(product.price)} />
          <Field label="공급원가" value={formatPrice(product.supply_price)} />
          {hasDiscountPeriod && (
            <Field
              label="할인 기간"
              value={`${product.discount_starts_at ? new Date(product.discount_starts_at).toLocaleString('ko-KR') : '-'} ~ ${product.discount_ends_at ? new Date(product.discount_ends_at).toLocaleString('ko-KR') : '-'}`}
            />
          )}
        </Card>

        <Card title="검수 정보">
          <Field label="제출자" value={submitterLabel} />
          <Field label="검수 상태" value={STATUS_LABEL[product.status]} />
          <Field
            label="공개 여부"
            value={product.is_active ? '공개' : '비공개'}
          />
          <Field
            label="좋아요 수"
            value={product.like_count.toLocaleString('ko-KR')}
          />
          <Field
            label="등록일"
            value={new Date(product.created_at).toLocaleString('ko-KR')}
          />
          <Field
            label="수정일"
            value={new Date(product.updated_at).toLocaleString('ko-KR')}
          />
        </Card>

        <Card title="상세 콘텐츠">
          {product.content_html ? (
            <div className="sm:col-span-2">
              <div
                // 이 프로젝트에는 @tailwindcss/typography(prose)가 설치되어 있지
                // 않아, sanitizeProductContentHtml() 허용 태그(h1~h3/p/ul/ol/li/
                // blockquote/hr/a/img 등)만 최소한으로 직접 스타일링한다.
                className="text-sm text-gray-900 dark:text-gray-100 space-y-3 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-gray-200 dark:[&_blockquote]:border-gray-700 [&_blockquote]:pl-3 [&_blockquote]:text-gray-500 [&_img]:max-w-full [&_img]:rounded-lg"
                // content_html은 저장 시 sanitizeProductContentHtml()로 이미
                // 서버에서 새니타이즈된 값이라 여기서 다시 정제하지 않는다.
                dangerouslySetInnerHTML={{ __html: product.content_html }}
              />
            </div>
          ) : (
            <div className="sm:col-span-2 text-sm text-gray-400">
              등록된 상세 콘텐츠가 없습니다
            </div>
          )}
        </Card>

        <Card title="이미지">
          {product.images && product.images.length > 0 ? (
            <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {product.images.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="w-full aspect-square object-cover rounded-lg border border-gray-100 dark:border-gray-700"
                />
              ))}
            </div>
          ) : (
            <div className="sm:col-span-2 text-sm text-gray-400">
              등록된 이미지가 없습니다
            </div>
          )}
        </Card>

        <Card title="구매항목">
          {product.purchase_options && product.purchase_options.length > 0 ? (
            <div className="sm:col-span-2 space-y-3">
              {product.purchase_options.map((option) => (
                <div
                  key={option.id}
                  className="rounded-lg border border-gray-100 dark:border-gray-700 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {option.label}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {option.is_inquiry_only
                        ? '별도 문의'
                        : formatPrice(option.price)}
                    </span>
                  </div>
                  {option.description && (
                    <p className="text-xs text-gray-400 mt-1">
                      {option.description}
                    </p>
                  )}
                  {option.work_period_days && (
                    <p className="text-xs text-gray-400 mt-1">
                      작업기간: {option.work_period_days}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="sm:col-span-2 text-sm text-gray-400">
              등록된 구매항목이 없습니다
            </div>
          )}
        </Card>

        <Card title="코드 미리보기">
          {product.code_preview && product.code_preview.length > 0 ? (
            <div className="sm:col-span-2 space-y-3">
              {product.code_preview.map((tab) => (
                <div key={tab.id}>
                  <p className="text-xs font-mono text-gray-400 mb-1">
                    {tab.label}
                  </p>
                  <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-900 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                    {tab.code}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="sm:col-span-2 text-sm text-gray-400">
              등록된 코드 미리보기가 없습니다
            </div>
          )}
        </Card>

        <Card title="기타">
          <div>
            <dt className="text-xs text-gray-400 mb-0.5">데모 URL</dt>
            <dd className="text-sm break-words">
              {product.demo_url ? (
                isSafeHttpUrl(product.demo_url) ? (
                  <a
                    href={product.demo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    {product.demo_url}
                  </a>
                ) : (
                  <span
                    className="text-gray-400 break-all"
                    title="안전하지 않은 URL 형식이라 링크로 열지 않습니다"
                  >
                    {product.demo_url}
                  </span>
                )
              ) : (
                '-'
              )}
            </dd>
          </div>
          <Field label="다운로드 파일 경로" value={product.file_path} mono />
          <Field
            label="AI 스타터킷 포함"
            value={product.has_ai_starter_kit ? '포함' : '미포함'}
          />
        </Card>
      </div>
    </div>
  );
}
