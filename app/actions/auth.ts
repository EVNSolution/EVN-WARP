'use server'

import { signIn, signOut } from '@/auth'
import { AuthError } from 'next-auth'

export async function loginAction(prevState: string | undefined, formData: FormData) {
  try {
    await signIn('credentials', formData)
  } catch (error) {
    if (error instanceof AuthError) {
      return '이메일 또는 비밀번호가 올바르지 않습니다.'
    }
    throw error // redirect 예외는 그대로 전파
  }
}

export async function logoutAction() {
  await signOut({ redirect: false })
}
