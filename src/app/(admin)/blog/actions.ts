'use server';

import {
  createPost,
  updatePost,
  deletePost,
  duplicatePost,
  updatePostsSortOrder,
} from '@/libs/supabase/queries/posts.admin';
import { requireAdminPage } from '@/libs/supabase/queries/auth';
import type { Post, PostFormInput, PostStatus } from '@/types/post';

export async function createPostAction(input: PostFormInput, status: PostStatus): Promise<Post> {
  await requireAdminPage();
  return createPost(input, status);
}

export async function updatePostAction(id: string, input: PostFormInput, status: PostStatus): Promise<Post> {
  await requireAdminPage();
  return updatePost(id, input, status);
}

export async function deletePostAction(id: string): Promise<void> {
  await requireAdminPage();
  return deletePost(id);
}

export async function duplicatePostAction(id: string): Promise<Post> {
  await requireAdminPage();
  return duplicatePost(id);
}

export async function updatePostsSortOrderAction(
  updates: { id: string; sort_order: number }[],
): Promise<void> {
  await requireAdminPage();
  return updatePostsSortOrder(updates);
}
