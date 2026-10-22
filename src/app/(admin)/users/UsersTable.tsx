'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import {
  MoreVertical,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Store,
  UserMinus,
} from 'lucide-react';
import { deleteUserAction, updateUserRoleAction } from './actions';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AlertDialog } from '@/components/ui/alert-dialog';
import type { AdminUserListItem } from '@/libs/supabase/queries/users';

function formatPhone(phone: string | null): string {
  if (!phone) return '-';
  return phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
}

interface UserRowProps {
  user: AdminUserListItem;
  isSelf: boolean;
  isBusy: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onDeleteClick: () => void;
  onRoleChangeClick: (role: 'user' | 'admin' | 'seller') => void;
}

function UserRow({
  user,
  isSelf,
  isBusy,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onDeleteClick,
  onRoleChangeClick,
}: UserRowProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl px-4 py-3 sm:px-6 sm:py-4 flex items-center gap-3 shadow-sm transition-opacity ${
        isBusy ? 'opacity-40' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {user.email}
          </span>
          {user.role === 'user' && user.seller_requested_at && (
            <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              판매자 신청함
            </span>
          )}
          {user.signup_provider === 'kakao' && (
            <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
              카카오 가입
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
          {formatPhone(user.phone)}
          &nbsp;&nbsp;
          {new Date(user.created_at).toLocaleDateString('ko-KR')} 가입
          {user.role === 'user' && user.seller_requested_at && (
            <>
              &nbsp;&nbsp;
              {new Date(user.seller_requested_at).toLocaleDateString(
                'ko-KR',
              )}{' '}
              판매자 신청
            </>
          )}
        </p>
      </div>

      <PopoverPrimitive.Root
        open={menuOpen}
        onOpenChange={(nextOpen) => (nextOpen ? onToggleMenu() : onCloseMenu())}
      >
        <PopoverPrimitive.Trigger asChild>
          <button
            disabled={isBusy}
            aria-label="더보기 메뉴"
            className={`shrink-0 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 ${
              menuOpen
                ? 'border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm'
                : ''
            }`}
          >
            <MoreVertical size={16} />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="end"
            side="bottom"
            sideOffset={4}
            collisionPadding={8}
            className="w-[160px] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg py-1 z-40"
          >
            {isSelf ? (
              <p className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500">
                본인 계정은 변경 불가
              </p>
            ) : user.role === 'admin' ? (
              <button
                onClick={() => onRoleChangeClick('user')}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 w-full text-left"
              >
                <ShieldOff size={14} />
                관리자 해제
              </button>
            ) : user.role === 'seller' ? (
              <button
                onClick={() => onRoleChangeClick('user')}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 w-full text-left"
              >
                <UserMinus size={14} />
                판매자 해제
              </button>
            ) : (
              <>
                <button
                  onClick={() => onRoleChangeClick('admin')}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 w-full text-left"
                >
                  <ShieldCheck size={14} />
                  관리자로 지정
                </button>
                <button
                  onClick={() => onRoleChangeClick('seller')}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 w-full text-left"
                >
                  <Store size={14} />
                  판매자로 전환
                </button>
              </>
            )}
            <button
              onClick={onDeleteClick}
              disabled={isSelf}
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-gray-50 dark:hover:bg-gray-700 w-full text-left disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} />
              삭제
            </button>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}

export default function UsersTable({
  users,
  currentUserId,
}: {
  users: AdminUserListItem[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(users);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    id: string;
    role: 'user' | 'admin' | 'seller';
  } | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    setItems(users);
  }, [users]);

  const closeMenu = () => setMenuOpenId(null);

  const handleDeleteClick = (id: string) => {
    setMenuOpenId(null);
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setConfirmOpen(false);
    setDeleting(pendingDeleteId);
    try {
      await deleteUserAction(pendingDeleteId);
      router.refresh();
    } catch {
      setAlertMessage('삭제에 실패했습니다.');
    } finally {
      setDeleting(null);
      setPendingDeleteId(null);
    }
  };

  const handleRoleChangeClick = (
    id: string,
    role: 'user' | 'admin' | 'seller',
  ) => {
    setMenuOpenId(null);
    setPendingRoleChange({ id, role });
  };

  const handleRoleChangeConfirm = async () => {
    if (!pendingRoleChange) return;
    const { id, role } = pendingRoleChange;
    setPendingRoleChange(null);
    setUpdatingRoleId(id);
    try {
      await updateUserRoleAction(id, role);
      router.refresh();
    } catch {
      setAlertMessage('역할 변경에 실패했습니다.');
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const admins = items.filter((user) => user.role === 'admin');
  const sellers = items.filter((user) => user.role === 'seller');
  // 판매자 신청한 사람을 먼저 보여줘서 관리자가 처리할 대상을 바로 찾을 수 있게 한다
  const generalUsers = items
    .filter((user) => user.role === 'user')
    .sort(
      (a, b) =>
        (b.seller_requested_at ? 1 : 0) - (a.seller_requested_at ? 1 : 0),
    );
  const pendingRoleChangeUser = pendingRoleChange
    ? items.find((user) => user.id === pendingRoleChange.id)
    : undefined;

  const renderSection = (title: string, sectionUsers: AdminUserListItem[]) => (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {sectionUsers.length}명
        </span>
      </div>
      {sectionUsers.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-4">
          해당하는 유저가 없습니다
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sectionUsers.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={user.id === currentUserId}
              isBusy={deleting === user.id || updatingRoleId === user.id}
              menuOpen={menuOpenId === user.id}
              onToggleMenu={() => setMenuOpenId(user.id)}
              onCloseMenu={closeMenu}
              onDeleteClick={() => handleDeleteClick(user.id)}
              onRoleChangeClick={(role) => handleRoleChangeClick(user.id, role)}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        title="유저를 삭제하시겠습니까?"
        description="계정과 프로필 정보가 즉시 삭제되며 복구할 수 없습니다."
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingDeleteId(null);
        }}
      />
      <ConfirmDialog
        open={!!pendingRoleChange}
        title={
          pendingRoleChange?.role === 'admin'
            ? '관리자로 지정하시겠습니까?'
            : pendingRoleChange?.role === 'seller'
              ? '판매자로 전환하시겠습니까?'
              : pendingRoleChangeUser?.role === 'seller'
                ? '판매자 권한을 해제하시겠습니까?'
                : '관리자 권한을 해제하시겠습니까?'
        }
        description={
          pendingRoleChange?.role === 'admin'
            ? '관리자로 지정되면 이 관리자 페이지 전체에 접근할 수 있습니다.'
            : pendingRoleChange?.role === 'seller'
              ? '판매자로 전환되면 gospelfix 마이페이지에서 직접 상품을 등록/수정/삭제할 수 있습니다.'
              : pendingRoleChangeUser?.role === 'seller'
                ? '이후 이 유저는 마이페이지에서 상품을 등록할 수 없습니다.'
                : '이후 이 유저는 관리자 페이지에 접근할 수 없습니다.'
        }
        confirmLabel="변경"
        onConfirm={handleRoleChangeConfirm}
        onCancel={() => setPendingRoleChange(null)}
      />
      <AlertDialog
        open={!!alertMessage}
        message={alertMessage ?? ''}
        onConfirm={() => setAlertMessage(null)}
      />

      <div className="flex flex-col gap-8">
        {renderSection('관리자', admins)}
        {renderSection('판매자', sellers)}
        {renderSection('일반', generalUsers)}
      </div>
    </>
  );
}
